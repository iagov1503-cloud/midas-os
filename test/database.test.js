const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
test('Banco persiste registros, valida entrada e rejeita conflitos', async () => {
 const dir=mkdtempSync(path.join(tmpdir(),'midas-test-'));
 const { execFileSync }=require('node:child_process');
 const run=(action,payload)=>JSON.parse(execFileSync(process.execPath,['-e',`const d=require('./database');try{console.log(JSON.stringify({status:200,data:d.${action}(${payload?JSON.stringify(payload):''})}))}catch(e){console.log(JSON.stringify({status:e.status||400,error:e.message}))}`],{cwd:path.join(__dirname,'..'),env:{...process.env,DB_PATH:path.join(dir,'test.sqlite')},encoding:'utf8'}));
 const request=async(method,payload)=>{const result=run(method==='GET'?'read':'write',payload);return {...result,json:async()=>result.data};};
 try{
  assert.deepEqual((await (await request('GET')).json()),{initialized:true,revision:0,tasks:[],events:[]});
  const payload={revision:0,tasks:[{id:'t1',title:'Teste',client:'Cliente',owner:'Iago',type:'Arte',status:'A fazer',due:'2026-10-30',priority:'Alta',created:'2026-10-30',completed:null}],events:[{id:'e1',title:'Reunião',client:'Midas',date:'2026-10-30',time:'09:00',type:'meet'}]};
  assert.equal((await request('PUT',payload)).status,200);
  assert.equal((await request('PUT',payload)).status,409);
  assert.equal((await request('PUT',{...payload,revision:1,tasks:[{...payload.tasks[0],due:'inválida'}]})).status,400);
  const saved=await (await request('GET')).json();assert.deepEqual(saved.tasks,payload.tasks);assert.deepEqual(saved.events,payload.events);assert.equal(saved.revision,1);
  assert.equal((await request('PUT',{revision:1,tasks:[],events:[]})).status,200);
  assert.deepEqual((await (await request('GET')).json()).tasks,[]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
