(function(root){
 'use strict';
 async function authRequest(route,data){
  let response;
  try{
   response=await fetch('/api/auth/'+route,{method:data?'POST':'GET',headers:{'Accept':'application/json',...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{}),cache:'no-store'});
  }catch{
   throw new Error('Não foi possível conectar ao servidor. Verifique se npm run dev está rodando e tente novamente.');
  }
  if(response.status===404)throw new Error('O servidor aberto está desatualizado. No terminal do VS Code, pare com Ctrl+C e execute npm run dev nesta pasta. Depois recarregue a página.');
  let result;
  try{result=JSON.parse(await response.text());}catch{
   throw new Error('O servidor não respondeu no formato esperado. Reinicie com npm run dev e recarregue a página.');
  }
  if(!response.ok)throw new Error(result?.error||'Não foi possível continuar. Tente novamente.');
  if(!result?.user?.id)throw new Error('Resposta de conta inválida. Reinicie o servidor e tente novamente.');
  return result;
 }
 if(typeof module==='object'&&module.exports)module.exports=authRequest;
 else root.midasAuthRequest=authRequest;
})(typeof window==='object'?window:globalThis);
