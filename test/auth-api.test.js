const {test}=require('node:test');
const assert=require('node:assert/strict');
const request=require('../public/js/auth-api');
test('Cadastro trata servidor antigo, resposta inválida e erros de conexão',async()=>{
 const original=global.fetch;
 try{
  global.fetch=async()=>({status:404});
  await assert.rejects(request('register',{}),/desatualizado/);
  global.fetch=async()=>({status:200,ok:true,text:async()=>'<html>Erro</html>'});
  await assert.rejects(request('register',{}),/formato esperado/);
  global.fetch=async()=>{throw new TypeError('The string did not match the expected pattern.');};
  await assert.rejects(request('register',{}),/conectar ao servidor/);
  global.fetch=async()=>({status:400,ok:false,text:async()=>JSON.stringify({error:'Celular já cadastrado.'})});
  await assert.rejects(request('register',{}),/Celular já cadastrado/);
  global.fetch=async(url,options)=>{assert.equal(url,'/api/auth/register');assert.equal(JSON.parse(options.body).password,'minhaSenha123');return {status:201,ok:true,text:async()=>JSON.stringify({user:{id:'1'}})};};
  assert.equal((await request('register',{password:'minhaSenha123'})).user.id,'1');
 }finally{global.fetch=original;}
});
