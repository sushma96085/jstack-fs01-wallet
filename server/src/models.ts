import mongoose, {Schema} from 'mongoose';
const userSchema=new Schema({name:{type:String,required:true},email:{type:String,required:true,unique:true,lowercase:true},passwordHash:{type:String,required:true},balance:{type:Number,required:true,default:1000000,min:0}});
const transferSchema=new Schema({fromUserId:{type:Schema.Types.ObjectId,ref:'WalletUser',required:true},toUserId:{type:Schema.Types.ObjectId,ref:'WalletUser',required:true},amount:{type:Number,required:true,min:100}},{timestamps:true});
const requestKeySchema=new Schema({senderId:{type:Schema.Types.ObjectId,required:true},key:{type:String,required:true},fingerprint:{type:String,required:true},result:{type:Schema.Types.Mixed,required:true}},{timestamps:true});
requestKeySchema.index({senderId:1,key:1},{unique:true});
transferSchema.index({fromUserId:1,createdAt:-1});
transferSchema.index({toUserId:1,createdAt:-1});

export const User=mongoose.models.WalletUser || mongoose.model('WalletUser',userSchema);
export const Transfer=mongoose.models.WalletTx || mongoose.model('WalletTx',transferSchema);
export const RequestKey=mongoose.models.WalletKey || mongoose.model('WalletKey',requestKeySchema);
