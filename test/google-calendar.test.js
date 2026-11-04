const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'midas-google-'));
process.env.DB_PATH=path.join(dir,'test.sqlite');
process.env.GOOGLE_CLIENT_ID='test-client';
process.env.GOOGLE_CLIENT_SECRET='test-secret';
process.env.GOOGLE_REDIRECT_URI='http://localhost:3000/api/google/callback';
const google=require('../google-calendar');
test('OAuth vincula o navegador, consome state uma vez e isola eventos por usuário',async()=>{
 const original=global.fetch;
 try{
  const flow=google.start('user-a'),url=new URL(flow.url),state=url.searchParams.get('state');
  assert.equal(url.searchParams.get('scope'),'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  const params=new URLSearchParams({state,code:'test-code'});
  await assert.rejects(google.callback(params,'wrong-browser'),/inválida/);
  global.fetch=async(url,options)=>{
   if(url==='https://oauth2.googleapis.com/token'){
    assert.equal(new URLSearchParams(options.body).get('grant_type'),'authorization_code');
    return {ok:true,json:async()=>({access_token:'private-token',refresh_token:'private-refresh',expires_in:3600,scope:'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events'})};
   }
   assert.equal(options.headers.Authorization,'Bearer private-token');
   if(url.includes('calendarList'))return {ok:true,json:async()=>({items:[{id:'team@example.com',summary:'Equipe'}]})};
   assert.match(url,/team%40example.com/);
   const u=new URL(url);
   assert.equal(u.searchParams.get('singleEvents'),'true');
   if(u.searchParams.get('pageToken'))return {ok:true,json:async()=>({items:[{id:'cancelled',status:'cancelled',start:{date:'2026-10-10'}}]})};
   return {ok:true,json:async()=>({timeZone:'UTC',nextPageToken:'page2',items:[
    {id:'all',summary:'Viagem',start:{date:'2026-10-10'},end:{date:'2026-10-12'}},
    {id:'timed',summary:'Reunião',start:{dateTime:'2026-10-10T01:00:00Z'},end:{dateTime:'2026-10-10T02:00:00Z'}},
    {id:'multi',summary:'Plantão',start:{dateTime:'2026-10-10T20:00:00-03:00'},end:{dateTime:'2026-10-12T00:00:00-03:00'}}
   ]})};
  };
  await google.callback(params,flow.binding);
  await assert.rejects(google.callback(params,flow.binding),/inválida/);
  assert.equal(google.status('user-a').connected,true);
  assert.equal(google.status('user-b').connected,false);
  assert.equal(JSON.stringify(google.status('user-a')).includes('private-token'),false);
  await assert.rejects(google.select('user-a','inaccessible'),/disponível/);
  await google.select('user-a','team@example.com');
  const events=await google.events('user-a','2026-10-01','2026-11-01');
  assert.equal(events.filter(e=>e.title==='Viagem').length,2);
  assert.equal(events.filter(e=>e.title==='Plantão').length,2);
  assert.equal(events.find(e=>e.title==='Reunião').date,'2026-10-09');
  assert.equal(events.find(e=>e.title==='Reunião').time,'22:00');
  assert.equal(events.some(e=>e.title==='cancelled'),false);
  assert.deepEqual(await google.events('user-b','2026-10-01','2026-11-01'),[]);
  await assert.rejects(google.events('user-a','2020-01-01','2026-11-01'),/inválido/);
  const database=require('../database');
  database.write({...database.read(),events:[{id:'local-event',title:'Captação',client:'Midas',date:'2026-11-04',time:'23:30',type:'capture'}]});
  let remote;
  global.fetch=async(url,options)=>{
   if(options.method==='POST'){
    const body=JSON.parse(options.body);
    assert.equal(body.start.dateTime,'2026-11-05T02:30:00.000Z');
    assert.equal(body.end.dateTime,'2026-11-05T03:30:00.000Z');
    if(remote)return {ok:false,status:409};
    remote={id:body.id,htmlLink:'https://calendar.google.com/event'};
   }
   return {ok:true,json:async()=>remote};
  };
  assert.equal((await google.publish('user-a','local-event')).googleEventId,remote.id);
  assert.equal((await google.publish('user-a','local-event')).googleEventId,remote.id);
  await assert.rejects(google.publish('user-b','local-event'),/Conecte/);
  google.disconnect('user-a');assert.equal(google.status('user-a').connected,false);
 }finally{global.fetch=original;fs.rmSync(dir,{recursive:true,force:true});}
});
