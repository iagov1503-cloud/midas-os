const path = require('node:path');

function publicOrigin(env = process.env) {
 if (!env.PUBLIC_URL) return '';
 const url = new URL(env.PUBLIC_URL);
 if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
  throw new Error('PUBLIC_URL deve conter somente a origem, por exemplo https://midas.exemplo.com.');
 }
 return url.origin;
}

function validateProduction(env = process.env) {
 const origin = publicOrigin(env);
 if (env.NODE_ENV !== 'production') return;
 if (!origin.startsWith('https://')) throw new Error('Configure PUBLIC_URL com o endereço HTTPS da hospedagem.');
 if (!env.DB_PATH || !path.isAbsolute(env.DB_PATH)) throw new Error('Configure DB_PATH com o caminho absoluto no volume persistente.');
 if (!env.REGISTRATION_CODE || env.REGISTRATION_CODE.length < 16) throw new Error('Configure REGISTRATION_CODE com pelo menos 16 caracteres para restringir os cadastros à equipe.');
 const google = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI];
 if (google.some(Boolean) && !google.every(Boolean)) throw new Error('Preencha as três variáveis GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI.');
 if (google.every(Boolean) && env.GOOGLE_REDIRECT_URI !== origin + '/api/google/callback') throw new Error('GOOGLE_REDIRECT_URI deve ser PUBLIC_URL + /api/google/callback.');
}

module.exports = { publicOrigin, validateProduction };
