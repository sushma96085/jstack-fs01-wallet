import 'dotenv/config';
import express,{type Request,type Response,type NextFunction} from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {User,Transfer,RequestKey} from './models.js';
import {WalletError,validateTransfer,requireKey,fingerprint,checkReplay} from './rules.js';

const app=express();app.disable('x-powered-by');app.use(cors({origin:(process.env.CLIENT_ORIGIN||'http://localhost:5173').split(',').map(x=>x.trim())}));app.use(express.json({limit:'16kb'}));
const secret=process.env.JWT_SECRET;if(!secret)throw new Error('JWT_SECRET is required');
let connection:Promise<typeof mongoose>|undefined;
async function db(){if(!process.env.MONGODB_URI)throw new Error('MONGODB_URI is required');connection??=mongoose.connect(process.env.MONGODB_URI).catch(e=>{connection=undefined;throw e});await connection}
async function seed(){const hash=await bcrypt.hash('password123',12);for(const [name,email] of [['Asha','asha@example.com'],['Rohan','rohan@example.com'],['Meera','meera@example.com']])await User.updateOne({email},{$setOnInsert:{name,email,passwordHash:hash,balance:1000000}},{upsert:true});}
const wrap=(fn:(req:Request,res:Response)=>Promise<unknown>)=>(req:Request,res:Response,next:NextFunction)=>{Promise.resolve(fn(req,res)).catch(next)};
app.get('/api/health',(_req,res)=>res.json({ok:true}));
app.post('/api/auth/login',wrap(async(req,res)=>{await db();const email=String(req.body?.email||'').trim().toLowerCase();if(['asha@example.com','rohan@example.com','meera@example.com'].includes(email))await seed();const user=await User.findOne({email});if(!user||!await bcrypt.compare(String(req.body?.password||''),user.passwordHash))throw new WalletError(401,'Invalid credentials');res.json({token:jwt.sign({sub:String(user.id)},secret,{expiresIn:'2h'}),user:{id:String(user.id),name:user.name,email:user.email}})}));
app.use('/api',(req,res,next)=>{try{const token=(req.headers.authorization||'').replace(/^Bearer /i,'');const payload=jwt.verify(token,secret) as jwt.JwtPayload;if(typeof payload.sub!=='string'||!mongoose.isValidObjectId(payload.sub))throw Error('Invalid token');res.locals.userId=payload.sub;next()}catch{res.status(401).json({error:'Login required'})}});
app.get('/api/wallet',wrap(async(_req,res)=>{await db();const user=await User.findById(res.locals.userId);if(!user)throw new WalletError(404,'Wallet not found');res.json({balance:user.balance,currency:'INR',unit:'paise'})}));
app.get('/api/users',wrap(async(_req,res)=>{await db();const users=await User.find({_id:{$ne:res.locals.userId}}).select('name email').lean();res.json(users.map(u=>({id:String(u._id),name:u.name,email:u.email})))}));
app.get('/api/transactions',wrap(async(_req,res)=>{await db();const id=res.locals.userId;const txs=await Transfer.find({$or:[{fromUserId:id},{toUserId:id}]}).sort({createdAt:-1,_id:-1}).limit(100).populate('fromUserId','name').populate('toUserId','name').lean();res.json(txs.map((t:any)=>({id:String(t._id),from:{id:String(t.fromUserId._id),name:t.fromUserId.name},to:{id:String(t.toUserId._id),name:t.toUserId.name},amount:t.amount,createdAt:t.createdAt})))}));
app.post('/api/wallet/transfer',wrap(async(req,res)=>{
 await db();const id=res.locals.userId as string;const key=requireKey(req.header('Idempotency-Key'));const {toUserId,amount}=req.body||{};const fp=fingerprint(toUserId,amount);
 const previous=await RequestKey.findOne({senderId:id,key}).lean();const replay=checkReplay(previous,fp);if(replay)return res.status(201).json(replay);
 validateTransfer(id,toUserId,amount,mongoose.isValidObjectId);
 const session=await mongoose.startSession();let result:unknown;
 try{await session.withTransaction(async()=>{
  const existing=await RequestKey.findOne({senderId:id,key}).session(session).lean();const seen=checkReplay(existing,fp);if(seen){result=seen;return}
  if(!await User.exists({_id:toUserId}).session(session))throw new WalletError(404,'Receiver not found');
  const sender=await User.findOneAndUpdate({_id:id,balance:{$gte:amount}},{$inc:{balance:-amount}},{new:true,session});if(!sender)throw new WalletError(409,'Insufficient balance');
  await User.updateOne({_id:toUserId},{$inc:{balance:amount}},{session});
  const [tx]=await Transfer.create([{fromUserId:id,toUserId,amount}],{session});result={message:'Transfer successful',transactionId:String(tx.id),amount,balance:sender.balance};
  await RequestKey.create([{senderId:id,key,fingerprint:fp,result}],{session});
 });res.status(201).json(result)}catch(err:any){if(err.code===11000){const existing=await RequestKey.findOne({senderId:id,key}).lean();const replay=checkReplay(existing,fp);if(replay)return res.status(201).json(replay)}if(err instanceof WalletError)throw err;throw new WalletError(503,'Transfer uncertain; retry with SAME Idempotency-Key')}finally{await session.endSession()}
}));
app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{if(err instanceof WalletError)return res.status(err.status).json({error:err.message});console.error(err);res.status(503).json({error:'Service unavailable'})});
if(process.env.NODE_ENV!=='test' && !process.env.VERCEL){const port=Number(process.env.PORT||5000);app.listen(port,()=>console.log('Wallet API listening on '+port));}
export {app};
