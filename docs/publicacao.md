# Publicar o Midas

O código está preparado para um serviço Node.js 24 com Docker e um volume persistente. O Railway pode hospedar essa estrutura sem converter o banco. A hospedagem só estará ativa depois da conexão à conta, criação do serviço e confirmação de um deployment saudável.

## Configuração do serviço

- Enviar o código usando o `Dockerfile` e `railway.json` da raiz.
- Criar um volume e montar em `/data`, antes da primeira inicialização.
- Usar uma única instância. O SQLite não deve ficar no sistema de arquivos temporário do container.
- Gerar o domínio HTTPS do serviço.
- Configurar `PUBLIC_URL` com esse domínio, por exemplo `https://midas.up.railway.app`.
- Definir `REGISTRATION_CODE` com um segredo aleatório de pelo menos 16 caracteres. Somente a equipe deve receber esse convite.
- O Docker já define `DB_PATH=/data/midas.sqlite`, `HOST=0.0.0.0` e `NODE_ENV=production`.
- A verificação da hospedagem é `GET /healthz`.

Não enviar `.env`, `data/`, senhas ou tokens junto ao código. Os arquivos de exclusão do pacote já cobrem esses caminhos.

## Preservar a operação existente

O pacote de código não leva o banco local. Para continuar com os cadastros e registros atuais, pare as gravações, faça uma cópia SQLite consistente e transfira essa cópia para `/data/midas.sqlite` no volume, antes da primeira utilização pública. Não substitua um banco de produção que já tenha recebido novos registros. Sem essa transferência, a instalação publicada começa vazia.

## Autorizar o Google

As credenciais OAuth precisam pertencer ao projeto Google Cloud da agência. Elas não são criadas por conectar o Google Calendar ao ChatGPT.

1. Ativar Google Calendar API no projeto.
2. Configurar a tela de consentimento e os usuários de teste, quando aplicável.
3. Autorizar os escopos `https://www.googleapis.com/auth/calendar.readonly` e `https://www.googleapis.com/auth/calendar.events`.
4. Criar um cliente OAuth do tipo aplicativo Web com redirecionamento exato `PUBLIC_URL/api/google/callback` (substituir PUBLIC_URL pelo domínio real).
5. Preencher `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` nas variáveis privadas da hospedagem.
6. Entrar no Midas, abrir Agenda completa e conectar a conta Google no navegador.

Sem acesso autorizado ao projeto Google Cloud, esses passos dependem do dono da conta. Não enviar o segredo pelo chat.

## Ativar o GPT

No Midas publicado, **Conectar ChatGPT** apresenta as instruções, o endereço de importação do esquema com o domínio correto e a geração da chave. No editor de GPTs da sua conta, criar **Assistente Midas**, importar o esquema e usar API Key/Bearer. A criação do GPT depende de acesso ao editor da conta; não existe neste ambiente uma ferramenta que faça essa alteração por você.

Validar com uma tarefa e um evento identificados como teste, conferindo os IDs retornados, a presença no Midas e a publicação na agenda Google escolhida. Esses testes externos ainda dependem de hospedagem e autorizações reais.

Referências: [configuração Railway](https://docs.railway.com/config-as-code), [volumes](https://docs.railway.com/volumes), [healthchecks](https://docs.railway.com/deployments/healthchecks), [Google OAuth Web](https://developers.google.com/identity/protocols/oauth2/web-server), [GPT Actions](https://developers.openai.com/api/docs/actions/getting-started).
