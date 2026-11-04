const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'data', 'midas.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS google_connections(user_id TEXT PRIMARY KEY, tokens TEXT NOT NULL, calendar_id TEXT NOT NULL DEFAULT 'primary');
CREATE TABLE IF NOT EXISTS google_oauth_states(state TEXT PRIMARY KEY, user_id TEXT NOT NULL, binding TEXT NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL);`);
const scope = 'https://www.googleapis.com/auth/calendar.readonly';
const writeScope = 'https://www.googleapis.com/auth/calendar.events';
const configured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
const connection = id => db.prepare('SELECT * FROM google_connections WHERE user_id=?').get(id);
function status(id) { return { configured: configured(), connected: !!connection(id), canPublish: !!connection(id) && !!JSON.parse(connection(id).tokens).scope?.split(' ').includes(writeScope), calendarId: connection(id)?.calendar_id || 'primary' }; }
function start(id) {
 if (!configured()) throw new Error('Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no servidor.');
 const state = crypto.randomBytes(32).toString('hex'), binding = crypto.randomBytes(32).toString('hex'), verifier = crypto.randomBytes(32).toString('base64url');
 db.prepare('DELETE FROM google_oauth_states WHERE expires<?').run(Date.now());
 db.prepare('INSERT INTO google_oauth_states VALUES (?,?,?,?,?)').run(state,id,binding,verifier,Date.now()+600000);
 const params = new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID, redirect_uri:process.env.GOOGLE_REDIRECT_URI, response_type:'code', scope:scope+' '+writeScope, access_type:'offline', prompt:'consent', state, code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
 return {url:'https://accounts.google.com/o/oauth2/v2/auth?'+params,binding};
}
async function tokenRequest(params) {
 const response = await fetch('https://oauth2.googleapis.com/token', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET}),signal:AbortSignal.timeout(15000)});
 const data = await response.json();
 if (!response.ok) throw new Error('Autorização Google expirou ou foi recusada. Conecte sua conta novamente.');
 return data;
}
async function callback(params, binding) {
 const row=db.prepare('SELECT * FROM google_oauth_states WHERE state=?').get(params.get('state')||'');
 if(!row || row.expires<Date.now() || !binding || row.binding!==binding)throw new Error('Autorização inválida ou expirada. Tente conectar novamente.');
 db.prepare('DELETE FROM google_oauth_states WHERE state=?').run(row.state);
 if(params.get('error') || !params.get('code'))throw new Error('A conexão com o Google não foi autorizada.');
 const tokens=await tokenRequest({code:params.get('code'),grant_type:'authorization_code',redirect_uri:process.env.GOOGLE_REDIRECT_URI,code_verifier:row.verifier});
 if(!tokens.access_token || !tokens.scope?.split(' ').includes(scope))throw new Error('Permita a leitura do Google Agenda para conectar.');
 tokens.expires_at=Date.now()+tokens.expires_in*1000;
 db.prepare("INSERT INTO google_connections(user_id,tokens) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET tokens=excluded.tokens").run(row.user_id,JSON.stringify(tokens));
}
async function api(id, resource, params={}, options={}) {
 const row=connection(id);if(!row)throw new Error('Conecte o Google Agenda primeiro.');
 let tokens=JSON.parse(row.tokens);
 if(tokens.expires_at<Date.now()+60000){
  if(!tokens.refresh_token)throw new Error('Conecte sua conta Google novamente.');
  tokens={...tokens,...await tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refresh_token})};
  tokens.expires_at=Date.now()+tokens.expires_in*1000;
  db.prepare('UPDATE google_connections SET tokens=? WHERE user_id=?').run(JSON.stringify(tokens),id);
 }
 const response=await fetch('https://www.googleapis.com/calendar/v3/'+resource+'?'+new URLSearchParams(params),{...options,headers:{Authorization:'Bearer '+tokens.access_token,...options.headers},signal:AbortSignal.timeout(15000)});
 if(response.status===409 && options.method==='POST')return api(id,resource+'/'+JSON.parse(options.body).id);
 if(!response.ok)throw new Error(response.status===401?'Conecte sua conta Google novamente.':'Não foi possível consultar o Google Agenda. Verifique a permissão e tente novamente.');
 return response.json();
}
async function calendars(id){
 let items=[],pageToken;
 do {const data=await api(id,'users/me/calendarList',{...(pageToken?{pageToken}:{})});items.push(...(data.items||[]).map(c=>({id:c.id,name:c.summary||c.id})));pageToken=data.nextPageToken;}while(pageToken);
 return items;
}
async function select(id, calendarId){
 if(!(await calendars(id)).some(c=>c.id===calendarId))throw new Error('Agenda não disponível nesta conta.');
 db.prepare('UPDATE google_connections SET calendar_id=? WHERE user_id=?').run(calendarId,id);
}
function localDateTime(value, timezone){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
 const get=key=>parts.find(p=>p.type===key).value;
 return {date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`};
}
async function events(id, from, to){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||'')||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||Date.parse(to)<=Date.parse(from)||Date.parse(to)-Date.parse(from)>370*86400000)throw new Error('Intervalo de datas inválido (máximo de um ano).');
 const row=connection(id);if(!row) return [];
 let result=[],pageToken;
 do{
  const data=await api(id,'calendars/'+encodeURIComponent(row.calendar_id)+'/events',{singleEvents:'true',orderBy:'startTime',timeMin:from+'T00:00:00-03:00',timeMax:to+'T00:00:00-03:00',maxResults:'2500',...(pageToken?{pageToken}:{})});
  for(const e of data.items||[]){
   if(e.status==='cancelled'||!e.start)continue;
   const allDay=!!e.start.date, timezone='America/Fortaleza';
   let start=allDay?{date:e.start.date,time:'Dia todo'}:localDateTime(e.start.dateTime,timezone);
   const end=allDay?e.end?.date:e.end?.dateTime?localDateTime(e.end.dateTime,timezone).date:start.date;
   // Expand multi-day events into daily display entries; Google all-day ends are exclusive.
   let day=start.date<from?from:start.date;
   while(day<to && (allDay?day<(end||start.date+'x'):day<=end && !(day===end && day!==start.date && localDateTime(e.end.dateTime,timezone).time==='00:00'))){
    if(day>=from)result.push({id:'google:'+e.id+':'+day,title:e.summary||'Sem título',client:'Google Agenda',date:day,time:allDay?'Dia todo':day===start.date?start.time:'Continuação',type:'meet',google:true,url:e.htmlLink?.startsWith('https://calendar.google.com/')?e.htmlLink:null});
    const next=new Date(day+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);day=next.toISOString().slice(0,10);
   }
  }
  pageToken=data.nextPageToken;
 }while(pageToken);
 return result;
}
function disconnect(id){db.prepare('DELETE FROM google_connections WHERE user_id=?').run(id);db.prepare('DELETE FROM google_oauth_states WHERE user_id=?').run(id);}
async function publish(id,eventId){
 const event=require('./database').read().events.find(e=>e.id===eventId);
 if(!event)throw new Error('Evento local não encontrado.');
 const row=connection(id);
 if(!row)throw new Error('Conecte o Google Agenda primeiro. O evento permanece salvo no Midas.');
 if(!JSON.parse(row.tokens).scope?.split(' ').includes(writeScope))throw new Error('Reconecte o Google Agenda para permitir a criação de eventos.');
 const start=new Date(event.date+'T'+event.time+':00-03:00');
 const remoteId=crypto.createHash('sha256').update(id+':'+event.id).digest('hex');
 const resource='calendars/'+encodeURIComponent(row.calendar_id)+'/events';
 const result=await api(id,resource,{}, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:remoteId,summary:event.title,description:'Cliente: '+event.client+'\nCriado pelo Midas OS.',start:{dateTime:start.toISOString(),timeZone:'America/Fortaleza'},end:{dateTime:new Date(start.getTime()+3600000).toISOString(),timeZone:'America/Fortaleza'}})});
 return {eventId:event.id,googleEventId:result.id,url:result.htmlLink,published:true};
}
module.exports={status,start,callback,calendars,select,events,disconnect,publish};
