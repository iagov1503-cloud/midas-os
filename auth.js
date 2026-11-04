const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname,'data','midas.sqlite'));
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,phone TEXT NOT NULL UNIQUE,secret_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);`);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const publicUser=row=>row?{id:row.id,name:row.name,role:row.role,phone:row.phone}:null;
function phone(value){
 let digits=String(value||'').replace(/\D/g,'');
 if(digits.length===13&&digits.startsWith('55'))digits=digits.slice(2);
 if(!/^[1-9]{2}9\d{8}$/.test(digits))throw new Error('Informe um celular brasileiro válido com DDD.');
 return digits;
}
function register(input){
 if(process.env.REGISTRATION_CODE && (typeof input.registrationCode !== 'string' || !crypto.timingSafeEqual(Buffer.from(hash(input.registrationCode)),Buffer.from(hash(process.env.REGISTRATION_CODE)))))throw new Error('Informe o código de convite da equipe para criar seu cadastro.');
 const name=typeof input.name==='string'?input.name.trim():'';
 const role=typeof input.role==='string'?input.role.trim():'';
 const number=phone(input.phone);
 if(name.length<2||name.length>100||role.length<2||role.length>100)throw new Error('Nome e função devem ter entre 2 e 100 caracteres.');
 if(db.prepare('SELECT id FROM users WHERE phone=?').get(number))throw new Error('Celular já cadastrado. Entre com sua senha.');
 const password=input.password;
 if(typeof password!=='string'||password.length<8||password.length>128)throw new Error('A senha deve ter entre 8 e 128 caracteres.');
 const salt=crypto.randomBytes(16).toString('hex');
 const id=crypto.randomUUID();
 db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(id,name,role,number,crypto.scryptSync(password,salt,64).toString('hex'),salt,Date.now());
 return {user:{id,name,role,phone:number}};
}
function login(input){
 const number=phone(input.phone);
 const password=typeof input.password==='string'?input.password:'';
 if(!password||password.length>128)throw new Error('Celular ou senha incorretos.');
 const user=db.prepare('SELECT * FROM users WHERE phone=?').get(number);
 const candidate=crypto.scryptSync(password,user?.salt||'invalid-user-salt',64);
 const expected=user?Buffer.from(user.secret_hash,'hex'):Buffer.alloc(64);
 if(!crypto.timingSafeEqual(candidate,expected)||!user)throw new Error('Celular ou senha incorretos.');
 return publicUser(user);
}
function createSession(user){
 const token=crypto.randomBytes(32).toString('hex');
 db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
 db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token),user.id,Date.now()+7*86400000);
 return token;
}
function getUser(token){if(!token)return null;return publicUser(db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').get(hash(token),Date.now()));}
function logout(token){if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));}
function listUsers(){return db.prepare('SELECT id,name,role FROM users ORDER BY name,id').all();}
module.exports={register,login,createSession,getUser,logout,listUsers};
