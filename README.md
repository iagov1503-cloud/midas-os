# Midas OS — MVP 4.0 Clean

Design atualizado, com **área de trabalho clara, sidebar azul-marinho, cartões brancos e azul nos elementos de ação**.

## Executar no VS Code

No Mac, também é possível abrir **Iniciar Midas.command** com dois cliques no Finder. O arquivo inicia o servidor no Terminal e abre o navegador depois que a porta estiver pronta. Deixe a janela do Terminal aberta. Se a porta 3000 estiver ocupada, a inicialização local tenta as próximas portas e mostra o endereço escolhido.

1. Abra a pasta `midas-os-clean-v4` no VS Code.
2. Instale Node.js 24+ (caso ainda não tenha).
3. No terminal, execute `npm start`.
4. Abra `http://localhost:3000`.

## Incluído

- Dashboard com indicadores, gráficos e calendário na página inicial.
- Kanban arrastável e com detalhes de cliente, tarefa, responsável, prazo e prioridade.
- Página de tarefas, filtros e edição.
- Equipe e ranking de produtividade.
- Calendário mensal/semanal com eventos cadastrados pela equipe.
- Entrada por voz, se o navegador suportar SpeechRecognition, e alternativa digitada.
- Persistência de tarefas e eventos em SQLite no servidor.

## Limites importantes

Este é um **MVP local para aprovação de interface**. O servidor atende apenas em localhost. Há cadastro e login locais. Há uma integração opcional de leitura do Google Agenda via OAuth. Há uma API de ações para um GPT dedicado no ChatGPT. A agenda começa vazia. O reconhecimento de fala depende do navegador e das permissões de microfone. Os indicadores refletem as tarefas cadastradas.

## Estrutura

- `public/index.html`: interface base.
- `public/css/style.css`: estilos, com bloco de tema Clean no final.
- `public/js/app.js`: navegação, tarefas, calendário, gráficos e interações.
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

## Google Agenda

A integração exibe os eventos do Google no painel e na agenda completa, junto aos eventos locais. Cada usuário conecta sua própria conta; seus eventos Google não são gravados na agenda compartilhada nem enviados para outras contas Midas. Criar, editar ou excluir um evento no Midas continua alterando apenas a agenda local. Para editar eventos Google, use **Abrir no Google Agenda**.

### 1. Criar o projeto e ativar a API

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) com a conta que vai administrar a integração.
2. No seletor de projetos, na parte superior, clique em **Novo projeto**. Use o nome `Midas OS` e clique em **Criar**. Se já tiver um projeto para o Midas, selecione-o.
3. Com esse projeto selecionado, abra **APIs e serviços → Biblioteca**.
4. Pesquise **Google Calendar API**, abra o resultado e clique em **Ativar**. Se aparecer **Gerenciar**, a API já está ativa.

### 2. Configurar a tela de consentimento

1. Abra **Google Auth Platform** no menu do console. Em algumas telas, o acesso começa em **APIs e serviços → Tela de consentimento OAuth**.
2. Se aparecer **Começar / Get started**, clique e preencha o nome do aplicativo como `Midas OS`, o e-mail de suporte e o e-mail de contato.
3. Em **Público-alvo / Audience**, escolha **Externo / External** para conectar contas Gmail ou pessoas de organizações diferentes. A opção **Interno / Internal**, quando disponível para Google Workspace, restringe o uso à organização.
4. Conclua a configuração. Para um aplicativo externo em **Teste / Testing**, abra **Público-alvo / Audience → Usuários de teste / Test users → Adicionar usuários**.
5. Adicione o e-mail exato de cada conta Google que conectará uma agenda e salve. Esse e-mail pode ser diferente da conta usada para administrar o projeto.
6. Em **Acesso a dados / Data Access**, clique em **Adicionar ou remover escopos**, procure e adicione o escopo abaixo. Atualize e salve:

   ```text
   https://www.googleapis.com/auth/calendar.readonly
   https://www.googleapis.com/auth/calendar.events
   ```

Os nomes dos menus podem aparecer em inglês. Consulte também a [configuração oficial do Google Calendar](https://developers.google.com/workspace/calendar/api/quickstart/nodejs) para a ativação da API e a tela de consentimento. Este projeto usa um cliente Web, conforme o próximo passo.

### 3. Criar as credenciais do aplicativo Web

1. No mesmo projeto, abra **Google Auth Platform → Clientes / Clients**.
2. Clique em **Criar cliente / Create client**.
3. Em **Tipo de aplicativo / Application type**, escolha **Aplicativo da Web / Web application**.
4. Dê o nome `Midas OS local`.
5. Em **URIs de redirecionamento autorizados / Authorized redirect URIs**, clique em **Adicionar URI** e cole exatamente:

   ```text
   http://localhost:3000/api/google/callback
   ```

6. Clique em **Criar** e copie o **ID do cliente / Client ID** e a **Chave secreta do cliente / Client secret**. Guarde o segredo ao criar o cliente.

O campo usado aqui é **URIs de redirecionamento autorizados**. O fluxo do servidor não exige preencher **Origens JavaScript autorizadas**. Não é necessário criar uma chave de API ou uma conta de serviço. Veja a [documentação de clientes OAuth do Google](https://support.google.com/cloud/answer/15549257?hl=en).

### 4. Preencher o arquivo `.env`

1. No VS Code, abra o terminal na pasta deste projeto.
2. Se ainda não existir um arquivo `.env`, crie uma cópia do modelo:

   ```sh
   cp -n .env.example .env
   ```

   Você também pode duplicar `.env.example` pelo explorador do VS Code e renomear a cópia para `.env`. Se o arquivo já existir, abra-o e preserve as outras configurações.

3. Preencha as três variáveis com suas credenciais. O exemplo abaixo contém valores fictícios; substitua as duas primeiras linhas:

   ```dotenv
   GOOGLE_CLIENT_ID=seu-id-do-cliente.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=seu-segredo-do-cliente
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
   ```

4. Salve o arquivo. O comando `npm start` carrega o `.env` automaticamente.

Não envie o segredo pelo chat nem coloque credenciais em arquivos da pasta `public`. O `.env` já está ignorado pelo Git.

### 5. Reiniciar e conectar a conta

1. Se o servidor estiver rodando, pare-o no terminal com **Ctrl+C**.
2. Execute:

   ```sh
   npm start
   ```

3. Abra **http://localhost:3000** no navegador. Use `localhost` também ao conectar; a autorização retorna para esse endereço.
4. Entre com seu cadastro do Midas e abra **Agenda completa**.
5. Clique em **Conectar Google Agenda**.
6. Na página do Google, selecione a conta adicionada como usuário de teste e autorize a leitura da agenda. Se houver um aviso de aplicativo em teste, confira se o nome e o projeto correspondem ao aplicativo que você criou antes de prosseguir pelas opções disponíveis.
7. Ao retornar ao Midas, escolha a agenda desejada no seletor **Google Agenda**. Para uma agenda compartilhada da equipe, escolha uma agenda que essa conta já consiga acessar no Google.
8. Clique em **Atualizar Google**. Os compromissos do período exibido devem aparecer no calendário e no painel inicial.

Para conferir, crie um compromisso no Google Agenda para hoje, volte ao Midas e clique em **Atualizar Google**. Ele deve aparecer com a origem **Google Agenda** e com o link **Abrir no Google Agenda** na lista do dia.

Cada pessoa precisa conectar sua conta no próprio cadastro Midas. Escolher uma agenda compartilhada não torna essa conexão visível automaticamente para os outros usuários do sistema.

### Se algo não funcionar

| Mensagem ou situação | O que conferir |
| --- | --- |
| “Configure GOOGLE_CLIENT_ID…” | Confira se o arquivo se chama exatamente `.env`, está na raiz do projeto e tem as três variáveis preenchidas. Reinicie com `npm start`. |
| `redirect_uri_mismatch` | A URI no cliente OAuth deve ser idêntica a `GOOGLE_REDIRECT_URI`, incluindo protocolo, porta e caminho, sem barra extra no final. |
| `access_denied` ou acesso bloqueado em teste | Confira se o e-mail selecionado está em **Audience → Test users** e se a organização permite esse aplicativo. |
| `invalid_client` ou autorização recusada | Confira se o Client ID e o Client Secret pertencem ao mesmo cliente Web e se foram copiados corretamente. |
| Voltou ao Midas sem concluir a conexão | Comece novamente pelo botão **Conectar Google Agenda**, no mesmo navegador. O pedido de conexão expira após dez minutos. |
| Conta conectada, mas nenhum evento aparece | Confira a agenda escolhida, o período exibido e se existem compromissos nesse intervalo. Clique em **Atualizar Google** e verifique se a Google Calendar API está ativa no mesmo projeto das credenciais. |
| A autorização deixou de funcionar | Conecte novamente. Aplicativos externos em teste podem exigir nova autorização; veja os [limites de expiração do Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server#expiration). |

Se usar outra porta, por exemplo `3001`, configure `PORT=3001` no `.env`, altere `GOOGLE_REDIRECT_URI` para `http://localhost:3001/api/google/callback` e cadastre essa mesma URI no cliente OAuth. Reinicie e acesse `http://localhost:3001`.

### Funcionamento da conexão

A conexão segue o [fluxo OAuth para servidores do Google](https://developers.google.com/identity/protocols/oauth2/web-server). Tokens ficam no banco local, somente no servidor; proteja a pasta `data` e seus backups. A nova autorização permite leitura e criação de eventos. Conexões anteriores precisam ser refeitas para permitir publicação. **Desconectar** remove os tokens locais; para revogar também a permissão no Google, remova o aplicativo nas conexões da sua Conta Google.

Os eventos são consultados ao abrir o sistema e navegar entre períodos; use **Atualizar Google** para buscar alterações feitas enquanto a página estiver aberta. Recorrências são expandidas pela API; eventos de vários dias aparecem em cada dia, com horários em America/Fortaleza. O carregamento cobre o mês exibido, seis semanas anteriores e dois meses seguintes. Falhas do Google aparecem na agenda e não impedem o uso das tarefas locais. A autorização ainda precisa ser feita no navegador; configurar o código não conecta automaticamente uma conta real.


## Assistente Midas no ChatGPT

Pacote de hospedagem: `Dockerfile`, `railway.json` e [guia de publicação](docs/publicacao.md). Em produção, `REGISTRATION_CODE` restringe novos cadastros à equipe; contas existentes continuam entrando com suas senhas.

Implementado com [GPT Actions](https://developers.openai.com/api/docs/actions/getting-started). O GPT interpreta pedidos na própria interface do ChatGPT e chama a API do Midas; não é necessário usar uma chave da API OpenAI no servidor.

1. Hospede este servidor Node.js 24+ com armazenamento SQLite persistente e HTTPS. Configure `PUBLIC_URL=https://seu-dominio.com`. Se necessário para a hospedagem, configure `HOST=0.0.0.0`; o padrão permanece localhost. Use uma única instância para o banco SQLite.
2. No Midas, entre na conta que será usada pelo GPT e clique em **Conectar ChatGPT → Gerar chave**. Copie a chave exibida uma única vez. Substituir ou revogar invalida o acesso anterior. Essa chave permite consultar e criar registros da operação compartilhada.
3. Na sua conta ChatGPT, abra o editor de GPTs e crie o **Assistente Midas**. Cole as instruções de `docs/chatgpt-instructions.md` no campo de instruções.
4. Adicione uma ação, cole o conteúdo de `public/chatgpt-openapi.json` e substitua `https://SEU-DOMINIO.com` pelo domínio HTTPS real. Configure autenticação **API Key → Bearer**, com a chave gerada pelo Midas. Não cole a chave nas instruções ou nas conversas.
5. Teste: “Crie uma tarefa de editar vídeo para [cliente], responsável [nome cadastrado], prazo [data]”. Para eventos: “Agende uma captação para [cliente] no dia [data] às 09h e envie ao Google Agenda”.
6. Recarregue o Midas para ver os registros criados pelo GPT. Abas com alterações concorrentes recebem erro de revisão; copie alterações pendentes antes de recarregar.

A criação real do GPT deve ser concluída pelo dono da conta no editor do ChatGPT. O agente atua apenas nas conversas feitas com esse GPT. Não acompanha automaticamente outros chats. O endereço localhost não é acessível pelas ações do ChatGPT.

### Enviar eventos ao Google

Além da leitura já existente, agora é possível publicar captações, reuniões e entregas. Adicione também o escopo `https://www.googleapis.com/auth/calendar.events` na tela de consentimento Google e reconecte a conta pelo Midas. Na hospedagem, altere `GOOGLE_REDIRECT_URI` e a URI autorizada do cliente OAuth para `https://seu-dominio.com/api/google/callback`.

Salve um evento e abra sua edição: **Enviar ao Google** publica na agenda selecionada da sua conta. Pelo GPT, a ação `publishMidasEvent` faz o mesmo. O evento tem duração padrão de uma hora. Cada publicação usa um ID estável; repetir não cria outra cópia. A conta precisa ter permissão de escrita na agenda selecionada.

A publicação é uma cópia: editar ou excluir depois no Midas não altera o Google. Falhas no Google preservam o registro local. Eventos publicados também aparecem na leitura Google, podendo aparecer junto da versão local na interface. Não há sincronização automática bidirecional. A autorização real e o teste com uma conta Google precisam ser feitos no navegador.
# midas-os
