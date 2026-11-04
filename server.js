// Midas OS — servidor local sem dependências externas.
// Execute: npm start  (Node.js 24+)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
if (require.main === module) config.validateProduction();
const database = require('./database');
const auth = require('./auth');
const google = require('./google-calendar');
const chatgpt = require('./chatgpt');
const attempts=new Map();
const root = path.join(__dirname, 'public');
const port = Number(process.env.PORT) || 3000;
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server = http.createServer(async (req,res)=>{
  const json = (status, value) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); };
  try {
  res.setHeader('X-Content-Type-Options','nosniff');
  const origin = config.publicOrigin();
  const secureCookie = origin.startsWith('https://') ? '; Secure' : '';
  const route=new URL(req.url,'http://localhost').pathname;
  const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('midas_session='))?.slice(14);
  const user=auth.getUser(token);
  if (!['GET','HEAD'].includes(req.method) && req.headers.origin && req.headers.origin !== (origin || `http://${req.headers.host}`)) return json(403,{error:'Origem não permitida.'});
  if(route==='/healthz' && req.method==='GET')return json(200,{ok:true});
  if(route==='/chatgpt-openapi.json' && req.method==='GET'){
    const schema=JSON.parse(fs.readFileSync(path.join(root,'chatgpt-openapi.json'),'utf8'));
    if(origin)schema.servers=[{url:origin}];
    return json(200,schema);
  }
  if(route==='/api/integrations/chatgpt/instructions' && req.method==='GET'){
    if(!user)return json(401,{error:'Faça login para continuar.'});
    return json(200,{instructions:fs.readFileSync(path.join(__dirname,'docs','chatgpt-instructions.md'),'utf8'),publicUrl:origin,google:google.status(user.id)});
  }
  const body=async()=>{
    if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Envie JSON.');
    let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>16384)throw new Error('Solicitação muito grande.');}
    const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Dados inválidos.');return value;
  };
  if(route==='/api/integrations/chatgpt'){
    if(!user)return json(401,{error:'Faça login para continuar.'});
    if(req.method==='GET')return json(200,chatgpt.status(user.id));
    if(req.method==='POST')return json(201,chatgpt.rotate(user.id));
    if(req.method==='DELETE'){chatgpt.revoke(user.id);return json(200,{ok:true});}
  }
  if(route.startsWith('/api/agent/')){
    const agentId=chatgpt.authenticate(req.headers.authorization);
    if(!agentId)return json(401,{error:'Chave do agente inválida ou revogada.'});
    try{
      if(route==='/api/agent/context'&&req.method==='GET')return json(200,chatgpt.context());
      if(route==='/api/agent/records'&&req.method==='POST')return json(201,chatgpt.create(agentId,await body()));
      if(route==='/api/agent/publish'&&req.method==='POST')return json(200,await google.publish(agentId,(await body()).eventId));
      return json(404,{error:'Rota não encontrada.'});
    }catch(error){return json(400,{error:error.message});}
  }
  if(route==='/api/google/callback'  && req.method==='GET'){
    const binding=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('midas_google_oauth='))?.slice(19);
    res.setHeader('Set-Cookie','midas_google_oauth=; HttpOnly; SameSite=Lax; Path=/api/google/callback; Max-Age=0'+secureCookie);
    let result='connected';
    try{await google.callback(new URL(req.url,'http://localhost').searchParams,binding);}catch{result='error';}
    res.writeHead(302,{Location:'/?google='+result,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();
  }
  if(route.startsWith('/api/google/')){
    if(!user)return json(401,{error:'Faça login para continuar.'});
    try{
      if(route==='/api/google/status'&&req.method==='GET')return json(200,google.status(user.id));
      if(route==='/api/google/connect'&&req.method==='POST'){
        const result=google.start(user.id);
        res.setHeader('Set-Cookie',`midas_google_oauth=${result.binding}; HttpOnly; SameSite=Lax; Path=/api/google/callback; Max-Age=600${secureCookie}`);
        return json(200,{url:result.url});
      }
      if(route==='/api/google/publish'&&req.method==='POST')return json(200,await google.publish(user.id,(await body()).eventId));
      if(route==='/api/google/calendars'&&req.method==='GET')return json(200,{calendars:await google.calendars(user.id)});
      if(route==='/api/google/calendar'&&req.method==='PUT'){await google.select(user.id,(await body()).calendarId);return json(200,{ok:true});}
      if(route==='/api/google/events'&&req.method==='GET'){
        const params=new URL(req.url,'http://localhost').searchParams;
        return json(200,{events:await google.events(user.id,params.get('from'),params.get('to'))});
      }
      if(route==='/api/google/disconnect'&&req.method==='POST'){google.disconnect(user.id);return json(200,{ok:true});}
      return json(405,{error:'Método não permitido.'});
    }catch(error){return json(400,{error:error.message});}
  }
  if(route.startsWith('/api/auth/')){
    if(route==='/api/auth/me'&&req.method==='GET')return json(user?200:401,user?{user}:{error:'Faça login para continuar.'});
    if(req.method!=='POST')return json(405,{error:'Método não permitido.'});
    if(route==='/api/auth/logout'){auth.logout(token);res.setHeader('Set-Cookie','midas_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+secureCookie);return json(200,{ok:true});}
    if(!['/api/auth/register','/api/auth/login'].includes(route))return json(404,{error:'Rota não encontrada.'});
    const now=Date.now();for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
    const ip=req.socket.remoteAddress;const limit=attempts.get(ip)||{count:0,until:now+600000};
    if(++limit.count>20){attempts.set(ip,limit);return json(429,{error:'Muitas tentativas. Aguarde 10 minutos.'});}attempts.set(ip,limit);
    try{
      const input=await body();
      if(route.endsWith('/register'))return json(201,auth.register(input));
      const logged=auth.login(input);const session=auth.createSession(logged);
      res.setHeader('Set-Cookie',`midas_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secureCookie}`);
      return json(200,{user:logged});
    }catch(error){return json(400,{error:error.message});}
  }
  if(route==='/api/users'){if(!user)return json(401,{error:'Faça login para continuar.'});if(req.method!=='GET')return json(405,{error:'Método não permitido.'});return json(200,{users:auth.listUsers()});}
  if(route==='/api/state'&&!user)return json(401,{error:'Faça login para continuar.'});
  if(['/', '/index.html'].includes(route)&&!user){res.writeHead(302,{Location:'/login.html'});return res.end();}
  if (req.url.split('?')[0] === '/api/state') {
    if (req.method === 'GET') return json(200, database.read());
    if (req.method !== 'PUT') return json(405, {error:'Método não permitido.'});
    if (!req.headers['content-type']?.startsWith('application/json')) return json(415, {error:'Envie JSON.'});
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 2*1024*1024) return json(413, {error:'Dados excedem 2 MB.'});
    }
    let data;
    try { data = JSON.parse(body); } catch { return json(400, {error:'JSON inválido.'}); }
    try { return json(200, database.write(data)); } catch (error) { return json(error.status || 400, {error:error.message}); }
  }
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const target = path.resolve(root, '.'+ (pathname==='/'?'/index.html':pathname));
  if (!target.startsWith(root+path.sep) && target!==root) { res.writeHead(403);return res.end('Acesso negado'); }
  fs.readFile(target,(err,data)=>{
    if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Arquivo não encontrado');}
    res.writeHead(200, {'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
  });
  } catch (error) { console.error(error); json(500, {error:'Não foi possível atender à solicitação.'}); }
});
if(require.main===module)server.listen(port, process.env.HOST || '127.0.0.1',()=>console.log(`Midas OS disponível em http://localhost:${port}`));
module.exports=server;
