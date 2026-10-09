import {createHash} from 'node:crypto';
export class WalletError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status}}
export function validateTransfer(senderId:string,receiverId:unknown,amount:unknown,isValidId:(s:string)=>boolean):asserts receiverId is string {
  if(typeof receiverId!=='string'||!isValidId(receiverId))throw new WalletError(400,'Invalid receiver');
  if(senderId===receiverId)throw new WalletError(400,'Cannot transfer to yourself');
  if(!Number.isSafeInteger(amount)||typeof amount!=='number'||amount<100||amount>5000000)throw new WalletError(400,'Amount must be integer paise between ₹1 and ₹50,000');
}
export function requireKey(value:unknown):string{if(typeof value!=='string'||!value.trim()||value.length>200)throw new WalletError(400,'Idempotency-Key header is required');return value;}
export function fingerprint(toUserId:unknown,amount:unknown){return createHash('sha256').update(JSON.stringify({toUserId,amount})).digest('hex')}
export function checkReplay(previous:{fingerprint:string,result:unknown}|null,fp:string){if(!previous)return null;if(previous.fingerprint!==fp)throw new WalletError(409,'Idempotency key reused with different payload');return previous.result}
