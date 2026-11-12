const {test}=require('node:test');
const assert=require('node:assert/strict');
const {today,monthDays}=require('../public/js/calendar');
test('Calendário usa a data de Fortaleza e muda à meia-noite local',()=>{
 const before=today(new Date('2026-11-06T02:59:59Z'));
 const after=today(new Date('2026-11-06T03:00:00Z'));
 assert.equal(before.getDate(),5);assert.equal(after.getDate(),6);
 assert.equal(after.getMonth(),10);
});
test('Grade mensal inclui todos os dias, com semanas começando na segunda',()=>{
 assert.equal(monthDays(new Date(2026,10,1)),42);
 assert.equal(monthDays(new Date(2027,1,1)),28);
 for(let month=0;month<12;month++){
  const d=new Date(2026,month,1);
  assert.ok(monthDays(d)>=(d.getDay()+6)%7+new Date(2026,month+1,0).getDate());
  assert.equal(monthDays(d)%7,0);
 }
});
