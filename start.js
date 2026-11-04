// Entrada local: carrega a configuração da pasta do projeto e explica falhas de inicialização.
const path = require('node:path');
const { execFile } = require('node:child_process');

try {
 try { process.loadEnvFile(path.join(__dirname, '.env')); }
 catch (error) { if (error.code !== 'ENOENT') throw error; }
 require('./config').validateProduction();
 const server = require('./server');
 const host = process.env.HOST || '127.0.0.1';
 let port = Number(process.env.PORT || 3000);
 if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT deve ser um número entre 1 e 65535.');
 const firstPort = port;
 server.on('error', error => {
  if (error.code === 'EADDRINUSE' && port < Math.min(firstPort + 10, 65535)) {
   console.log(`A porta ${port} está ocupada. Tentando ${port + 1}…`);
   port += 1;
   server.listen(port, host);
   return;
  }
  if (['EPERM', 'EACCES'].includes(error.code)) {
   console.error('\nO ambiente bloqueou a abertura da porta do Midas.');
   console.error('No Mac, abra Iniciar Midas.command pelo Finder para executar no Terminal.');
  } else {
   console.error('\nNão foi possível iniciar o Midas: ' + error.message);
  }
  process.exitCode = 1;
 });
 server.on('listening', () => {
  const browserHost = ['0.0.0.0', '127.0.0.1', '::', 'localhost'].includes(host) ? '127.0.0.1' : host;
  const url = `http://${browserHost.includes(':') ? '[' + browserHost + ']' : browserHost}:${port}`;
  console.log(`\nMidas OS iniciado: ${url}`);
  console.log('Deixe este Terminal aberto enquanto usa o sistema. Para encerrar, pressione Ctrl+C.\n');
  if (process.platform === 'darwin' && process.env.MIDAS_OPEN_BROWSER === '1') {
   execFile('/usr/bin/open', [url], error => {
    if (error) console.log('Abra o endereço acima no navegador.');
   });
  }
 });
 server.listen(port, host);
} catch (error) {
 console.error('\nNão foi possível iniciar o Midas: ' + error.message);
 console.error('O projeto precisa do Node.js 24 ou superior.');
 process.exitCode = 1;
}
