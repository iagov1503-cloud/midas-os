const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'midas-agent-'));
process.env.DB_PATH=path.join(dir,'test.sqlite');
const server=require('../server');
test('Agente autentica, grava sem duplicar, preserva dados e revoga acesso',async()=>{
 const integration=require('../chatgpt'),database=require('../database');
 const user=require('../auth').register({name:'Iago',role:'Gestor',phone:'85912345678',password:'password123',confirmPassword:'password123'});
 const userId=user.user?.id||user.id;
 const {token}=integration.rotate(userId);
 const call=(route,body,key=token)=>new Promise(resolve=>{
  const req=require('node:stream').Readable.from(body?[JSON.stringify(body)]:[]);
  Object.assign(req,{url:'/api/agent/'+route,method:body?'POST':'GET',headers:{authorization:'Bearer '+key,'content-type':'application/json',host:'localhost'},socket:{remoteAddress:'test'}});
  const res={setHeader(){},writeHead(status){this.status=status;},end(value){resolve({status:this.status,json:async()=>JSON.parse(value)});}};
  server.emit('request',req,res);
 });
 try{
  assert.equal((await call('context',null,'wrong')).status,401);
  const context=await (await call('context')).json();assert.equal(context.users[0].phone,undefined);
  const task={requestId:'one',kind:'task',title:'Arte',client:'Midas',owner:'Iago',due:'2026-11-05'};
  let response=await call('records',task);assert.equal(response.status,201);const first=await response.json();
  assert.deepEqual(await (await call('records',task)).json(),first);
  assert.equal((await call('records',{...task,title:'Alterado'})).status,400);
  assert.equal((await call('records',{...task,requestId:'invalid',due:'2026-02-30'})).status,400);
  const event={requestId:'two',kind:'capture',title:'Captação',client:'Midas',date:'2026-11-06',time:'09:00'};
  assert.equal((await call('records',event)).status,201);
  assert.equal(database.read().tasks.length,1);assert.equal(database.read().events.length,1);
  assert.equal(database.read().revision,2);
  integration.rotate(userId);assert.equal((await call('context')).status,401);
  integration.revoke(userId);assert.equal(integration.status(userId).connected,false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
