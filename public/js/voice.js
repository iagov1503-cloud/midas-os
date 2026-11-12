(function(root){
'use strict';
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const numbers={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20};
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
function parse(input,{clients=[],members=[],today=new Date()}={}){
 const original=input.trim();if(!original)return null;
 let text=normalize(original).replace(/\b[a-z]+\b/g,w=>numbers[w]===undefined?w:String(numbers[w]));
 const clientIntent=/\b(pacote|contrato|mensalidade|cadastrar cliente|cadastre cliente|novo cliente|adicionar cliente|adicione cliente|receber no mes)\b/.test(text)||/\b(cliente|receber)\b.*\b(por mes|mensais|mensal|por mensalidade)\b/.test(text);
 const eventIntent=/\b(agenda|agendar|agende|reuniao|captacao|compromisso|evento|marcar|marque)\b/.test(text);
 const taskIntent=/\b(tarefa|card|kanban|produzir|editar|criar|crie|fazer|adicione|adicionar)\b/.test(text);
 const kind=clientIntent?'client':/\b(tarefa|card|kanban)\b/.test(text)?'task':eventIntent?'event':taskIntent?'task':null;
 const known=[...clients].sort((a,b)=>b.length-a.length).find(c=>text.includes(normalize(c)));
 let client=known||'';
 if(!client){
  const match=original.match(/(?:cliente\s+|(?:para|com|da|do)\s+(?:a\s+|o\s+)?)(.+?)(?=\s+(?:com|em|no m[eê]s|para o m[eê]s|at[eé]|amanh[ãa]|hoje|dia|[àa]s|na|no|toda|todo|que|deve|vai|recebe|receber|respons[aá]vel)\b|[,;]|$)/i);
  if(match)client=match[1].trim();
 }
 let date='';
 const anchor=new Date(today);anchor.setHours(12,0,0,0);
 const explicit=text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
 const short=text.match(/\b(?:dia\s+)?(\d{1,2})[\/](\d{1,2})(?:[\/](\d{4}))?\b/);
 if(explicit)date=explicit[0];
 else if(short)date=(short[3]||anchor.getFullYear())+'-'+short[2].padStart(2,'0')+'-'+short[1].padStart(2,'0');
 else if(/\bhoje\b/.test(text))date=iso(anchor);
 else if(/\b(?:depois de )?amanha\b/.test(text)){anchor.setDate(anchor.getDate()+(/depois de amanha/.test(text)?2:1));date=iso(anchor)}
 else{
  const weekdays=['domingo','segunda','terca','quarta','quinta','sexta','sabado'],day=weekdays.findIndex(d=>new RegExp('\\b'+d+'\\b').test(text));
  if(day>=0){let offset=(day-anchor.getDay()+7)%7;if(!offset)offset=7;if(/semana que vem|proxima semana/.test(text)){const monday=new Date(anchor);monday.setDate(monday.getDate()+((8-monday.getDay())%7||7));anchor.setTime(monday.getTime());offset=(day+6)%7}anchor.setDate(anchor.getDate()+offset);date=iso(anchor)}
  else {const dayOnly=text.match(/\bdia (\d{1,2})\b/);if(dayOnly){anchor.setDate(Number(dayOnly[1]));date=iso(anchor)}}
 }
 if(date){const check=new Date(date+'T12:00:00');if(Number.isNaN(check.getTime())||iso(check)!==date)date=''}
 let time='';const hour=text.match(/\b(?:as\s+|horario\s+)(\d{1,2})(?:[:h](\d{2}))?(?:\s*horas)?\b/)||text.match(/\b(\d{1,2})[:h](\d{2})\b/);
 if(hour){let h=Number(hour[1]),m=Number(hour[2]||0);if(/da tarde|da noite/.test(text)&&h<12)h+=12;if(h<24&&m<60)time=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')}
 const count=type=>Number(text.match(new RegExp('\\b(\\d+)\\s+'+type+'\\b'))?.[1]||0);
 const videos=count('(?:videos?|reels?)'),arts=count('(?:artes?|posts?)');
 const type=/trafego/.test(text)?'Gestão de tráfego':/carrosse/.test(text)?'Carrossel':/artes?|posts?/.test(text)?'Arte':/roteiro/.test(text)?'Roteiro':/captacao/.test(text)?'Captação':/videos?|reels?/.test(text)?'Vídeo':'Outro';
 const owner=members.find(m=>new RegExp('(?:para|com|responsavel|pelo|pela)\\s+(?:a\\s+|o\\s+)?'+normalize(m.name).replace(/[.*+?^$()|[\]\\]/g,'\\$&')+'\\b').test(text))?.name||'';
 const months=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
 let month=iso(today).slice(0,7);
 const ym=text.match(/\b(\d{4})-(0[1-9]|1[0-2])\b/),named=months.findIndex(m=>new RegExp('\\b'+m+'\\b').test(text));
 if(ym)month=ym[0];else if(named>=0)month=(text.match(/\b20\d{2}\b/)?.[0]||today.getFullYear())+'-'+String(named+1).padStart(2,'0');
 else if(/mes que vem|proximo mes/.test(text))month=iso(new Date(today.getFullYear(),today.getMonth()+1,1)).slice(0,7);
 const eventType=/captacao/.test(text)?'capture':/entrega/.test(text)?'deliver':'meet';
 const eventLabel={capture:'Captação',deliver:'Entrega',meet:'Reunião'}[eventType];
 const title=kind==='event'?eventLabel+(client?' — '+client:''):original.replace(/^(?:midas[,!]?\s*|criar?\s+|adicione?\s+|adicionar\s+|nova?\s+tarefa\s*)+/i,'').trim();
 return {kind,client,owner,date,time,month,videos,arts,traffic:/gestao de trafego|trafego pago/.test(text)&&!/sem (?:gestao de )?trafego/.test(text),services:original,type,eventType,title,quantity:Math.max(1,Math.min(20,count('(?:videos?|reels?|artes?|posts?|carrosseis|roteiros?|tarefas?)')||1)),priority:/urgent|prioridade alta/.test(text)?'Alta':'Média'};
}
if(typeof module==='object'&&module.exports)module.exports={parse};else root.MidasVoice={parse};
})(typeof globalThis==='object'?globalThis:this);
