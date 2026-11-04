const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const database = require('./database');
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname,'data','midas.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS integration_keys(user_id TEXT PRIMARY KEY, digest TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS integration_requests(user_id TEXT NOT NULL, request_id TEXT NOT NULL, payload TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(user_id,request_id));`);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function rotate(id){const token=crypto.randomBytes(32).toString('base64url');db.prepare('INSERT INTO integration_keys VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET digest=excluded.digest').run(id,digest(token));return {token};}
function revoke(id){db.prepare('DELETE FROM integration_keys WHERE user_id=?').run(id);}
function authenticate(header){if(!header?.startsWith('Bearer '))return null;return db.prepare('SELECT user_id FROM integration_keys WHERE digest=?').get(digest(header.slice(7)))?.user_id || null;}
function status(id){return {connected:!!db.prepare('SELECT user_id FROM integration_keys WHERE user_id=?').get(id)};}
function context(){return {today:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza'}).format(new Date()),timeZone:'America/Fortaleza',users:require('./auth').listUsers().map(({name,role})=>({name,role})),...database.read()};}
function create(id,input){
 if(typeof input.requestId!=='string'||!input.requestId.trim()||input.requestId.length>120)throw new Error('Informe requestId único (até 120 caracteres).');
 const payload=JSON.stringify(input);
 const prior=db.prepare('SELECT * FROM integration_requests WHERE user_id=? AND request_id=?').get(id,input.requestId);
 if(prior){if(prior.payload!==payload)throw new Error('requestId já usado com outros dados.');return JSON.parse(prior.result);}
 const state=database.read(), today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza'}).format(new Date());
 const record={id:crypto.randomUUID(),title:input.title,client:input.client};
 if(input.kind==='task'){
  if(!require('./auth').listUsers().some(u=>u.name===input.owner))throw new Error('Escolha um responsável cadastrado.');
  Object.assign(record,{owner:input.owner,type:input.type||'Outro',due:input.due,priority:input.priority||'Média',status:'A fazer',created:today,completed:null});state.tasks.unshift(record);
 }else if(['capture','meet','deliver'].includes(input.kind)){
  Object.assign(record,{date:input.date,time:input.time,type:input.kind});state.events.push(record);
 }else throw new Error('Tipo inválido.');
 // Both database handles point at the same file. Persist the record and receipt atomically on the main connection.
 return database.atomicCreate(state,()=>{
  const result={record,revision:state.revision+1};
  database.receipt(id,input.requestId,payload,JSON.stringify(result));return result;
 });
}
module.exports={rotate,revoke,authenticate,status,context,create};
