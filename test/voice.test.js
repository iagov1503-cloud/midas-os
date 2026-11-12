const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('../public/js/voice');
const context={today:new Date(2026,10,5,12),clients:['Karasu','JC Plásticos'],members:[{name:'Design'},{name:'Ana (Design)'}]};
test('Voz encaminha tarefas e preserva quantidade, cliente e responsável',()=>{
 const p=parse('Criar três artes para a JC Plásticos até sexta, para Design.',context);
 assert.equal(p.kind,'task');assert.equal(p.quantity,3);assert.equal(p.type,'Arte');assert.equal(p.client,'JC Plásticos');assert.equal(p.owner,'Design');assert.equal(p.date,'2026-11-06');
 assert.equal(parse('Editar vídeo para Karasu',context).date,'');
 assert.equal(parse('Criar tarefa para Karasu',context).owner,'');
 assert.equal(parse('Criar tarefa de captação para Karasu',context).kind,'task');
});
test('Voz reconhece agenda, datas e horários sem preencher dados ausentes',()=>{
 const p=parse('Agendar captação com Karasu amanhã às 14h30',context);
 assert.equal(p.kind,'event');assert.equal(p.eventType,'capture');assert.equal(p.date,'2026-11-06');assert.equal(p.time,'14:30');assert.equal(p.title,'Captação — Karasu');
 assert.equal(parse('Reunião com Karasu dia 12/11/2026 às 3 da tarde',context).time,'15:00');
 assert.equal(parse('Agendar reunião com Karasu',context).time,'');
 assert.equal(parse('Agendar reunião dia 31/02/2026',context).date,'');
 assert.equal(parse('Agendar reunião com Karasu segunda da semana que vem',context).date,'2026-11-09');
});
test('Voz reconhece pacotes mensais e nomes novos',()=>{
 const p=parse('Cadastrar cliente Nova Marca com oito vídeos, quatro artes e gestão de tráfego para dezembro',context);
 assert.equal(p.kind,'client');assert.equal(p.client,'Nova Marca');assert.equal(p.videos,8);assert.equal(p.arts,4);assert.equal(p.traffic,true);assert.equal(p.month,'2026-12');
 assert.equal(parse('Pacote Karasu para próximo mês com 8 vídeos e sem gestão de tráfego',context).traffic,false);
 assert.equal(parse('Cadastrar cliente Karasu com 2 captações e 8 vídeos',context).kind,'client');
 assert.equal(parse('Ideias novas',context).kind,null);
 assert.equal(parse('  ',context),null);
});
