const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const filename = process.env.DB_PATH || path.join(__dirname, 'data', 'midas.sqlite');
fs.mkdirSync(path.dirname(filename), { recursive: true });
const db = new DatabaseSync(filename);
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, client TEXT NOT NULL, owner TEXT NOT NULL,
 type TEXT NOT NULL, status TEXT NOT NULL, due TEXT NOT NULL, priority TEXT NOT NULL,
 created TEXT NOT NULL, completed TEXT, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, client TEXT NOT NULL, date TEXT NOT NULL,
 time TEXT NOT NULL, type TEXT NOT NULL, position INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS tasks_due ON tasks(due);
CREATE INDEX IF NOT EXISTS events_date ON events(date);`);
// Remove only the original demo identities, once; retain user-created records.
db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
if (!db.prepare('SELECT name FROM migrations WHERE name=?').get('remove-demo-v1')) {
 const demo=require('./demo-records.json');
 const matches=Object.entries(demo).flatMap(([table,rows])=>rows.filter(row=>db.prepare(`SELECT id FROM ${table} WHERE id=? AND title=? AND client=?`).get(row.id,row.title,row.client)).map(row=>({table,...row})));
 if(matches.length) {
  const backup=filename+'.before-demo-cleanup-'+Date.now()+'.sqlite';
  db.prepare('VACUUM INTO ?').run(backup);
  console.log('Backup antes da limpeza: '+backup);
 }
 db.exec('BEGIN IMMEDIATE');
 try {
  for(const row of matches)db.prepare(`DELETE FROM ${row.table} WHERE id=? AND title=? AND client=?`).run(row.id,row.title,row.client);
  db.prepare('INSERT INTO metadata VALUES (1,?) ON CONFLICT(id) DO UPDATE SET revision=revision+1').run(matches.length?1:0);
  db.prepare('INSERT INTO migrations VALUES (?)').run('remove-demo-v1');
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
function read() {
 const meta = db.prepare('SELECT revision FROM metadata WHERE id=1').get();
 const rows = table => db.prepare(`SELECT * FROM ${table} ORDER BY position`).all().map(({position, ...row}) => row);
 return { initialized: !!meta, revision: meta?.revision || 0, tasks: rows('tasks'), events: rows('events') };
}
function validate(data) {
 if (!data || !Number.isSafeInteger(data.revision) || !Array.isArray(data.tasks) || !Array.isArray(data.events)) throw new Error('Dados inválidos.');
 const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
 for (const [table, fields] of [['tasks',['id','title','client','owner','type','status','due','priority','created']], ['events',['id','title','client','date','time','type']]]) {
  const ids = new Set();
  for (const row of data[table]) {
   if (!row || fields.some(key => typeof row[key] !== 'string' || !row[key].trim() || row[key].length > 2000) || ids.has(row.id)) throw new Error('Registro inválido ou duplicado.');
   ids.add(row.id);
   if (table === 'tasks' && (!date(row.due) || !date(row.created) || (row.completed !== null && !date(row.completed)) || !['A fazer','Em produção','Em aprovação','Concluído'].includes(row.status) || !['Normal','Média','Alta'].includes(row.priority))) throw new Error('Tarefa inválida.');
   if (table === 'events' && (!date(row.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time) || !['capture','meet','deliver'].includes(row.type))) throw new Error('Evento inválido.');
  }
 }
}
function write(data, receiptCallback) {
 validate(data);
 db.exec('BEGIN IMMEDIATE');
 try {
  if (read().revision !== data.revision) { const error = new Error('Os dados foram alterados em outra aba. Recarregue a página antes de continuar.'); error.status = 409; throw error; }
  db.exec('DELETE FROM tasks; DELETE FROM events;');
  const task = db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  data.tasks.forEach((t,i) => task.run(t.id,t.title,t.client,t.owner,t.type,t.status,t.due,t.priority,t.created,t.completed,i));
  const event = db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?)');
  data.events.forEach((e,i) => event.run(e.id,e.title,e.client,e.date,e.time,e.type,i));
  db.prepare('INSERT INTO metadata VALUES (1,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision').run(data.revision+1);
  const result=receiptCallback ? receiptCallback() : { revision: data.revision+1 };
  db.exec('COMMIT');
  return result;
 } catch (error) { db.exec('ROLLBACK'); throw error; }
}
function receipt(user,request,payload,result){db.prepare('INSERT INTO integration_requests VALUES (?,?,?,?)').run(user,request,payload,result);}
module.exports = { read, write, atomicCreate: write, receipt };
