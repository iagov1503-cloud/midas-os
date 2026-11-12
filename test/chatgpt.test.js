const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'midas-agent-'));
process.env.DB_PATH=path.join(dir,'test.sqlite');
const server=require('../server');
test('Ações antigas ficam indisponíveis mesmo com uma chave previamente válida',async()=>{
 const integration=require('../chatgpt'),database=require('../database');
 const user=require('../auth').register({name:'Iago',role:'Gestor',phone:'85912345678',password:'password123',confirmPassword:'password123'});
 const {token}=integration.rotate(user.user?.id||user.id);
 const before=database.read();
 const call=(route,body)=>new Promise(resolve=>{
  const req=require('node:stream').Readable.from(body?[JSON.stringify(body)]:[]);
  Object.assign(req,{url:'/api/agent/'+route,method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json',host:'localhost'},socket:{remoteAddress:'test'}});
  const res={setHeader(){},writeHead(status){this.status=status;},end(){resolve(this.status);}};
  server.emit('request',req,res);
 });
 try{
  assert.equal(await call('context'),404);
  assert.equal(await call('records',{kind:'task',title:'Arte',client:'Midas',owner:'Iago',due:'2026-11-05'}),404);
  assert.equal(await call('publish',{eventId:'old'}),404);
  assert.deepEqual(database.read(),before);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
