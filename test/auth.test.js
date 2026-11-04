const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'midas-auth-'));
process.env.DB_PATH=path.join(dir,'auth.sqlite');
const server=require('../server');
const {Readable}=require('node:stream');
function request(url,method='GET',data,cookie){
 return new Promise(resolve=>{
  const req=Readable.from(data?[JSON.stringify(data)]:[]);
  Object.assign(req,{url,method,headers:{host:'localhost:3000','content-type':'application/json',...(cookie?{cookie}:{})},socket:{remoteAddress:'test'}});
  const headers={};
  const res={setHeader:(key,value)=>headers[key.toLowerCase()]=value,writeHead:(status,values)=>{res.status=status;Object.assign(headers,values);},end:body=>resolve({status:res.status,headers,body:body?JSON.parse(body):null})};
  server.emit('request',req,res);
 });
}
test('Cadastro, login, sessão, proteção da API e logout',async()=>{
 assert.equal((await request('/api/users')).status,401);
 assert.equal((await request('/api/state')).status,401);
 assert.equal((await request('/api/state','PUT',{})).status,401);
 assert.equal((await request('/api/auth/register','POST',{name:'Iago',role:'Design',phone:'123'})).status,400);
 for(const password of [undefined,'curta','x'.repeat(129)]) assert.equal((await request('/api/auth/register','POST',{name:'Iago',role:'Design',phone:'85988888888',password})).status,400);
 const registered=await request('/api/auth/register','POST',{name:'Iago',role:'Design',phone:'(85) 99999-9999',password:'Minha senha 123'});
 assert.equal(registered.status,201);assert.equal(registered.body.user.name,'Iago');assert.equal(registered.body.code,undefined);assert.equal(registered.body.password,undefined);
 assert.equal((await request('/api/auth/register','POST',{name:'Outro',role:'Editor',phone:'+55 85 99999-9999'})).status,400);
 assert.equal((await request('/api/auth/login','POST',{phone:'85999999999',password:'errado'})).status,400);
 const logged=await request('/api/auth/login','POST',{phone:'85999999999',password:'Minha senha 123'});
 assert.equal(logged.status,200);
 const cookie=logged.headers['set-cookie'].split(';')[0];
 assert.match(logged.headers['set-cookie'],/HttpOnly; SameSite=Strict/);
 assert.equal((await request('/api/auth/me','GET',null,cookie)).body.user.role,'Design');
 const team=await request('/api/users','GET',null,cookie);
 assert.deepEqual(team.body.users,[{id:registered.body.user.id,name:'Iago',role:'Design'}]);
 const initial=await request('/api/state','GET',null,cookie);assert.deepEqual(initial.body.tasks,[]);assert.deepEqual(initial.body.events,[]);
 assert.equal(initial.status,200);
 assert.equal((await request('/api/auth/logout','POST',{},cookie)).status,200);
 assert.equal((await request('/api/state','GET',null,cookie)).status,401);
 const auth=require('../auth');const user=auth.login({phone:'85999999999',password:'Minha senha 123'});
 const token=auth.createSession(user);
 const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.DB_PATH);
 const stored=db.prepare('SELECT * FROM users').get();assert.notEqual(stored.secret_hash,'Minha senha 123');assert.equal(stored.code,undefined);
 db.prepare('UPDATE sessions SET expires_at=0').run();assert.equal(auth.getUser(token),null);db.close();
});
