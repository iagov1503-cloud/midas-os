(()=>{'use strict';
const $=id=>document.getElementById(id);let mode='login',busy=false;
function switchMode(next){
 if(busy)return;mode=next;const registering=mode==='register';
 $('registrationCode').disabled=!registering;$('registerFields').hidden=!registering;$('confirmField').hidden=!registering;
 for(const id of ['name','role','confirmPassword']){$(id).required=registering;$(id).disabled=!registering;}
 $('password').value='';$('confirmPassword').value='';$('confirmPassword').setCustomValidity('');
 $('password').autocomplete=registering?'new-password':'current-password';$('password').minLength=registering?8:1;
 $('password').placeholder=registering?'Crie uma senha com pelo menos 8 caracteres':'Digite sua senha';
 $('formTitle').textContent=registering?'Faça parte da Midas':'Acesse seu workspace';
 $('description').textContent=registering?'Preencha seus dados e crie sua senha de acesso.':'Entre com seu celular e senha.';
 $('submitButton').textContent=registering?'Criar meu cadastro →':'Entrar no Midas OS →';
 $('footnote').textContent=registering?'Já tem cadastro? Selecione “Entrar”.':'Primeiro acesso? Selecione “Criar cadastro”.';$('message').textContent='';
 for(const type of ['login','register']){$(type+'Tab').classList.toggle('active',type===mode);$(type+'Tab').setAttribute('aria-pressed',String(type===mode));}
}
$('loginTab').onclick=()=>switchMode('login');$('registerTab').onclick=()=>switchMode('register');
const validateConfirmation=()=>{$('confirmPassword').setCustomValidity(mode==='register'&&$('confirmPassword').value!==$('password').value?'As senhas precisam ser iguais.':'');};
$('password').oninput=$('confirmPassword').oninput=validateConfirmation;
$('authForm').onsubmit=async event=>{
 event.preventDefault();if(busy)return;validateConfirmation();if(!event.target.reportValidity())return;
 busy=true;$('submitButton').disabled=true;$('message').textContent='Aguarde…';
 try{
  const data=Object.fromEntries(new FormData(event.target));
  await window.midasAuthRequest(mode,data);
  if(mode==='login'){location.assign('/');return;}
  busy=false;switchMode('login');$('message').textContent='Cadastro criado! Entre com seu celular e a senha que você escolheu.';$('password').focus();
 }catch(error){$('message').textContent=error.message||'Falha de conexão. Tente novamente.';}
 finally{busy=false;$('submitButton').disabled=false;}
};
fetch('/api/auth/me',{cache:'no-store'}).then(response=>{if(response.ok)location.replace('/');else if(response.status===404)$('message').textContent='O servidor em execução está desatualizado. Pare com Ctrl+C no terminal e execute npm run dev. Depois recarregue esta página.';}).catch(()=>{$('message').textContent='Sem conexão com o servidor. Execute npm run dev no terminal e tente novamente.';});
})();
