(function(root){
'use strict';
function today(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return new Date(Number(values.year),Number(values.month)-1,Number(values.day),12);
}
function monthDays(date){
 const first=new Date(date.getFullYear(),date.getMonth(),1,12);
 const offset=(first.getDay()+6)%7;
 return Math.ceil((offset+new Date(date.getFullYear(),date.getMonth()+1,0).getDate())/7)*7;
}
const api={today,monthDays};
if(typeof module==='object'&&module.exports)module.exports=api;else root.MidasCalendar=api;
})(globalThis);
