# Midas OS — MVP 4.0 Clean

Design atualizado, com **área de trabalho clara, sidebar azul-marinho, cartões brancos e azul nos elementos de ação**.

## Executar no VS Code

No Mac, também é possível abrir **Iniciar Midas.command** com dois cliques no Finder. O arquivo inicia o servidor no Terminal e abre o navegador depois que a porta estiver pronta. Deixe a janela do Terminal aberta. Se a porta 3000 estiver ocupada, a inicialização local tenta as próximas portas e mostra o endereço escolhido.

1. Abra a pasta `midas-os-clean-v4` no VS Code.
2. Instale Node.js 24+ (caso ainda não tenha).
3. No terminal, execute `npm start`.
4. Abra `http://localhost:3000`.

## Incluído

- Visão geral com indicadores de tarefas e entregas.
- Kanban arrastável e com detalhes de cliente, tarefa, responsável, prazo e prioridade.
- Página de tarefas, filtros e edição.
- Temas claro e escuro, com preferência salva no navegador e compartilhada com o login.
- Persistência de tarefas em SQLite no servidor.

## Limites importantes

Este é um gestor de tarefas local com cadastro e login. Agenda, comandos de voz, pacotes mensais, ranking e integrações externas foram retirados da interface. As rotas antigas de Google Agenda e ChatGPT retornam 404, inclusive para chaves antigas. Os registros anteriores permanecem no banco para preservar os dados.

## Estrutura

- `public/index.html`: interface base.
- `public/css/style.css`: estilos, com bloco de tema Clean no final.
- `public/js/app.js`: navegação, tarefas, gráficos e interações.
- `server.js`: servidor Node.js sem dependências externas.

## Banco de dados

Execute `npm start` e acesse `http://localhost:3000`. O banco é criado automaticamente em `data/midas.sqlite`, com tabelas `tasks`, `events` e `metadata` (controle de versão). A integração usa o módulo nativo `node:sqlite`, sem instalar dependências.

O banco começa vazio, sem importar localStorage ou criar exemplos. Tarefas e eventos são gravados no SQLite; a equipe vem exclusivamente da tabela de usuários cadastrados. O cliente é informado ao criar uma tarefa ou evento, e os filtros usam esses nomes.

Na atualização, a migração remove apenas os registros originais de demonstração identificados por ID, título e cliente. Antes de remover, cria uma cópia SQLite consistente em `data/midas.sqlite.before-demo-cleanup-<timestamp>.sqlite`. Contas cadastradas e registros criados manualmente são preservados. Reinicie o servidor após atualizar o código.

A API `GET /api/state` carrega os registros; `PUT /api/state` salva tarefas e eventos em uma transação. A gravação exige a revisão atual e rejeita alterações concorrentes com HTTP 409. Nesse caso, copie alterações pendentes e recarregue a página. Falhas de gravação aparecem em um aviso persistente; não considere uma alteração salva enquanto houver esse aviso.

Para fazer backup, pare o servidor e copie a pasta `data` inteira. Para restaurar, com o servidor parado, substitua essa pasta pela cópia. Não apague o banco para atualizar o projeto. O diretório `data` é ignorado pelo Git.

Opcional: `DB_PATH=/caminho/midas.sqlite npm start` permite escolher o arquivo. Esta configuração é para uso local; acesso externo exige configurar HTTPS, entrega e recuperação de credenciais e permissões antes de publicar.

## Cadastro e login

Abra `http://localhost:3000`: visitantes são direcionados à página de acesso. Na aba **Criar cadastro**, preencha somente **nome, função, celular brasileiro com DDD e uma senha escolhida pela pessoa**.

A senha deve ter entre 8 e 128 caracteres e ser confirmada no cadastro. Para entrar, use o celular e a senha escolhida. Não há envio de SMS nem recuperação automática de senha nesta versão. Contas criadas anteriormente com código continuam aceitando o código antigo como senha. Cadastrar um celular não verifica a titularidade da linha.

As contas ficam na tabela `users`. As senhas são armazenadas como hash com salt usando scrypt; as sessões ficam na tabela `sessions`, com validade de sete dias e cookie HttpOnly/SameSite. O botão **Sair** invalida a sessão. A API de tarefas e eventos exige login. Todas as contas cadastradas compartilham a operação da agência e podem editar tarefas e eventos; a função informada é descritiva e não concede permissões diferentes.

Execute `npm test` para verificar banco, cadastro, login, sessões, bloqueio de acesso anônimo e logout.


## Aparência

Use **Modo escuro** no topo da tela para usar à noite. O botão passa a **Modo claro** para voltar. A preferência permanece ao recarregar e vale também para a página de acesso.
