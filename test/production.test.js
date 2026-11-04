const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {publicOrigin,validateProduction}=require('../config');

test('Configuração de produção exige HTTPS, banco persistente e convite',()=>{
 const env={NODE_ENV:'production',PUBLIC_URL:'https://midas.example/',DB_PATH:'/data/midas.sqlite',REGISTRATION_CODE:'test-invite-code-123'};
 assert.equal(publicOrigin(env),'https://midas.example');
 assert.doesNotThrow(()=>validateProduction(env));
 for(const change of [{PUBLIC_URL:'http://midas.example'},{DB_PATH:'local.sqlite'},{REGISTRATION_CODE:''},{GOOGLE_CLIENT_ID:'client'},{GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_REDIRECT_URI:'http://localhost:3000/api/google/callback'}]){
  assert.throws(()=>validateProduction({...env,...change}));
 }
 assert.throws(()=>publicOrigin({PUBLIC_URL:'https://midas.example/path'}));
});

test('Publicação restringe cadastro, usa cookies seguros e entrega esquema com domínio real',async()=>{
 const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'midas-production-'));
 const original={PUBLIC_URL:process.env.PUBLIC_URL,DB_PATH:process.env.DB_PATH,REGISTRATION_CODE:process.env.REGISTRATION_CODE};
 process.env.DB_PATH=path.join(dir,'test.sqlite');
 process.env.PUBLIC_URL='https://midas.example/';
 process.env.REGISTRATION_CODE='test-invite-code-123';
 const server=require('../server');
 const call=(url,method='GET',body,extraHeaders={})=>new Promise(resolve=>{
  const req=require('node:stream').Readable.from(body?[JSON.stringify(body)]:[]);
  Object.assign(req,{url,method,headers:{host:'internal-proxy','content-type':'application/json',...extraHeaders},socket:{remoteAddress:'test-production'}});
  const headers={};
  const res={setHeader(key,value){headers[key.toLowerCase()]=value;},writeHead(status,values){this.status=status;Object.assign(headers,values);},end(value){resolve({status:this.status,headers,data:value?JSON.parse(value):null});}};
  server.emit('request',req,res);
 });
 try{
  assert.equal((await call('/healthz')).status,200);
  assert.equal((await call('/chatgpt-openapi.json')).data.servers[0].url,'https://midas.example');
  assert.equal((await call('/api/integrations/chatgpt')).status,401);
  assert.equal((await call('/api/integrations/chatgpt/instructions')).status,401);
  const account={name:'Iago',role:'Gestor',phone:'85912345678',password:'test-password'};
  assert.equal((await call('/api/auth/register','POST',account)).status,400);
  assert.equal((await call('/api/auth/register','POST',{...account,registrationCode:process.env.REGISTRATION_CODE},{origin:'https://midas.example'})).status,201);
  const login=await call('/api/auth/login','POST',account,{origin:'https://midas.example'});
  assert.equal(login.status,200);assert.match(login.headers['Set-Cookie']||login.headers['set-cookie'],/; Secure/);
  assert.equal((await call('/api/auth/login','POST',account,{origin:'https://other.example'})).status,403);
 }finally{
  for(const [key,value] of Object.entries(original)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
