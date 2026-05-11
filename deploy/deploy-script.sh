#!/bin/bash
set -e
echo "=== Writing server files ==="

cat > /app/server.js << 'ENDOFSERVER'
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./server/database');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ===== Middleware =====
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ===== Login accounts (same as frontend) =====
var LOGIN_ACCOUNTS = [
    { account: 'admin',    password: 'admin123',   label: '管理员' },
    { account: 'manager1', password: 'mgr123456',  label: '经理 - 张伟' },
    { account: 'manager2', password: 'mgr123456',  label: '经理 - 李娜' },
    { account: 'hr1',      password: 'hr123456',   label: '人事 - 王芳' },
    { account: 'hr2',      password: 'hr123456',   label: '人事 - 刘洋' },
    { account: 'finance1', password: 'fin123456',  label: '财务 - 陈静' },
    { account: 'finance2', password: 'fin123456',  label: '财务 - 赵磊' },
    { account: 'store1',   password: 'store1234',  label: '门店经理 - 周明' },
    { account: 'store2',   password: 'store1234',  label: '门店经理 - 吴鑫' },
    { account: 'viewer',   password: 'view1234',   label: '访客(只读)' }
];

// ===== Token store (in-memory, survives server restart = all clients re-login) =====
var tokenStore = {}; // token -> { account, label, createdAt }

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ===== Auth middleware =====
function authMiddleware(req, res, next) {
    var authHeader = req.headers.authorization;
    var token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }
    if (!token) {
        token = req.query.token || '';
    }
    if (!token || !tokenStore[token]) {
        return res.status(401).json({ ok: false, error: '未登录或登录已过期' });
    }
    req.user = tokenStore[token];
    next();
}

// ===== SSE connections =====
var sseClients = [];

function broadcast(eventType, payload) {
    var data = JSON.stringify(payload);
    sseClients.forEach(function(client) {
        try {
            client.write('event: ' + eventType + '\ndata: ' + data + '\n\n');
        } catch(e) {
            // Client disconnected, will be removed on close
        }
    });
}

// ===== Login =====
app.post('/api/login', function(req, res) {
    var account = (req.body.account || '').trim();
    var password = (req.body.password || '');

    if (!account || !password) {
        return res.json({ ok: false, error: '请输入账户和密码' });
    }

    var found = null;
    for (var i = 0; i < LOGIN_ACCOUNTS.length; i++) {
        if (LOGIN_ACCOUNTS[i].account === account) { found = LOGIN_ACCOUNTS[i]; break; }
    }
    if (!found || found.password !== password) {
        return res.json({ ok: false, error: '账户或密码错误，请重试' });
    }

    var token = generateToken();
    tokenStore[token] = { account: found.account, label: found.label, createdAt: Date.now() };

    res.json({ ok: true, user: { account: found.account, label: found.label }, token: token });
});

app.post('/api/logout', authMiddleware, function(req, res) {
    var authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        var token = authHeader.slice(7);
        delete tokenStore[token];
    }
    res.json({ ok: true });
});

// ===== Data endpoints (all protected) =====

app.get('/api/data/all', authMiddleware, function(req, res) {
    try {
        var data = db.getAllData();
        res.json({ ok: true, data: data });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/artists', authMiddleware, function(req, res) {
    try {
        var result = db.addArtist(req.body);
        broadcast('artist-added', { id: result.id });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/artists/:id', authMiddleware, function(req, res) {
    try {
        req.body.id = parseInt(req.params.id, 10);
        db.updateArtist(req.body);
        broadcast('artist-updated', { id: req.body.id });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.delete('/api/artists/:id', authMiddleware, function(req, res) {
    try {
        db.deleteArtist(parseInt(req.params.id, 10));
        broadcast('artist-deleted', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/contracts', authMiddleware, function(req, res) {
    try {
        var result = db.addContract(req.body);
        broadcast('contract-added', { id: result.id });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/contracts/:id', authMiddleware, function(req, res) {
    try {
        req.body.id = parseInt(req.params.id, 10);
        db.updateContract(req.body);
        broadcast('contract-updated', { id: req.body.id });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/salaries', authMiddleware, function(req, res) {
    try {
        var result = db.addSalaries(req.body);
        broadcast('salaries-added', { count: result.count });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/evaluations', authMiddleware, function(req, res) {
    try {
        var result = db.addEvaluations(req.body);
        broadcast('evaluations-added', { count: result.count });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/artists/:id/photos', authMiddleware, function(req, res) {
    try {
        var artistId = parseInt(req.params.id, 10);
        var photosJson = req.body.photos || '[]';
        db.saveArtistPhotos(artistId, photosJson);
        broadcast('photos-updated', { id: artistId });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/upload/avatar', authMiddleware, function(req, res) {
    try {
        var dataUrl = req.body.dataUrl;
        var artistName = req.body.name;
        if (!dataUrl || !artistName) {
            return res.json({ ok: false, error: '缺少参数' });
        }
        var filePath = db.saveAvatar(dataUrl, artistName);
        broadcast('avatar-updated', { path: filePath });
        res.json({ ok: true, path: filePath });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/reset', authMiddleware, function(req, res) {
    try {
        db.resetAllData();
        broadcast('data-reset', {});
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.get('/api/ping', function(req, res) {
    res.json({ ok: true });
});

app.get('/api/health', function(req, res) {
    res.json({ status: 'ok', uptime: process.uptime(), dbPath: process.env.DB_PATH || '(default)' });
});

// ===== SSE endpoint =====
app.get('/api/events', function(req, res) {
    // Auth via query param (EventSource doesn't support custom headers)
    var token = req.query.token || '';
    if (!token || !tokenStore[token]) {
        return res.status(401).json({ ok: false, error: '未登录' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    sseClients.push(res);

    // Send initial keepalive
    res.write(':ok\n\n');

    req.on('close', function() {
        var idx = sseClients.indexOf(res);
        if (idx !== -1) sseClients.splice(idx, 1);
    });
});

// ===== Static file serving (after API routes) =====
app.use('/node_modules', express.static(path.join(ROOT, 'node_modules')));
app.use('/src', express.static(path.join(ROOT, 'src')));
app.use('/build', express.static(path.join(ROOT, 'build')));

// Fallback: serve index.html for root
app.get('/', function(req, res) {
    res.sendFile(path.join(ROOT, 'src', 'index.html'));
});

// ===== Start =====
db.init();
app.listen(PORT, function() {
    console.log('');
    console.log('  艺人管理系统服务器已启动！');
    console.log('  端口: ' + PORT);
    console.log('  数据库: ' + (process.env.DB_PATH || '(默认)'));
    console.log('  本地访问: http://localhost:' + PORT);
    console.log('  按 Ctrl+C 停止服务器');
    console.log('');
});

ENDOFSERVER

cat > /app/server/database.js << 'ENDOFDATABASE'
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

var DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'db', 'artist_data.db');

var db;

var DESIRED_STORES = ['胡桃里中心城','胡桃里时代城','18般罗湖店','18般广州店','Ahouse厦门店','Ahouse无锡店','南宁见山谣','南宁滚滚','昆明滚滚','昆明Bongbong','海口苏荷'];

function init() {
  var dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
  syncStores();
  var row = db.prepare('SELECT COUNT(*) AS c FROM artists').get();
  if (!row || row.c === 0) seedData();
}

function createTables() {
  db.exec("CREATE TABLE IF NOT EXISTS stores (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    name TEXT NOT NULL UNIQUE\n  )");
  db.exec("CREATE TABLE IF NOT EXISTS artists (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    name TEXT NOT NULL,\n    avatar TEXT DEFAULT '',\n    gender TEXT DEFAULT '',\n    store_id INTEGER,\n    store_name TEXT DEFAULT '',\n    positions TEXT DEFAULT '[]',\n    business_level TEXT DEFAULT 'C级',\n    sign_status TEXT DEFAULT '未签约',\n    daily_salary REAL DEFAULT 0,\n    status TEXT DEFAULT '在岗',\n    id_card TEXT DEFAULT '',\n    phone TEXT DEFAULT '',\n    photos TEXT DEFAULT '[]',\n    created_at TEXT DEFAULT (datetime('now','localtime')),\n    updated_at TEXT DEFAULT (datetime('now','localtime'))\n  )");
  try { db.exec("ALTER TABLE artists ADD COLUMN photos TEXT DEFAULT '[]'"); } catch(_) {}
  db.exec("CREATE TABLE IF NOT EXISTS contracts (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    artist_id INTEGER NOT NULL,\n    artist_name TEXT DEFAULT '',\n    positions TEXT DEFAULT '[]',\n    brand TEXT DEFAULT '',\n    gender TEXT DEFAULT '',\n    id_card TEXT DEFAULT '',\n    phone TEXT DEFAULT '',\n    start_date TEXT DEFAULT '',\n    end_date TEXT DEFAULT '',\n    contract_no TEXT DEFAULT '',\n    sign_status TEXT DEFAULT '未签约',\n    created_at TEXT DEFAULT (datetime('now','localtime'))\n  )");
  db.exec("CREATE TABLE IF NOT EXISTS evaluations (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    artist_id INTEGER NOT NULL,\n    artist_name TEXT DEFAULT '',\n    store_name TEXT DEFAULT '',\n    overall_score REAL DEFAULT 0,\n    responsibility_score REAL DEFAULT 0,\n    stability_score REAL DEFAULT 0,\n    teamwork_score REAL DEFAULT 0,\n    adaptability_score REAL DEFAULT 0,\n    business_score REAL DEFAULT 0,\n    tags TEXT DEFAULT '[]',\n    comment TEXT DEFAULT '',\n    evaluated_at TEXT DEFAULT (datetime('now','localtime'))\n  )");
  try { db.exec("ALTER TABLE evaluations ADD COLUMN responsibility_score REAL DEFAULT 0"); } catch(_) {}
  try { db.exec("ALTER TABLE evaluations ADD COLUMN stability_score REAL DEFAULT 0"); } catch(_) {}
  try { db.exec("ALTER TABLE evaluations ADD COLUMN teamwork_score REAL DEFAULT 0"); } catch(_) {}
  try { db.exec("ALTER TABLE evaluations ADD COLUMN adaptability_score REAL DEFAULT 0"); } catch(_) {}
  try { db.exec("ALTER TABLE evaluations ADD COLUMN business_score REAL DEFAULT 0"); } catch(_) {}
  db.exec("CREATE TABLE IF NOT EXISTS salaries (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    month TEXT DEFAULT '',\n    store_name TEXT DEFAULT '',\n    nature TEXT DEFAULT '',\n    artist_name TEXT DEFAULT '',\n    position TEXT DEFAULT '',\n    daily_salary REAL DEFAULT 0,\n    performance_days INTEGER DEFAULT 0,\n    monthly_salary REAL DEFAULT 0,\n    team_fee REAL DEFAULT 0,\n    travel_fee REAL DEFAULT 0,\n    rent_utility_fee REAL DEFAULT 0,\n    total_amount REAL DEFAULT 0,\n    created_at TEXT DEFAULT (datetime('now','localtime'))\n  )");
  try { db.exec("ALTER TABLE salaries ADD COLUMN nature TEXT DEFAULT ''"); } catch(_) {}
  try { db.exec("ALTER TABLE salaries ADD COLUMN monthly_salary REAL DEFAULT 0"); } catch(_) {}
  try { db.exec("ALTER TABLE salaries ADD COLUMN team_fee REAL DEFAULT 0"); } catch(_) {}
  try { db.exec("ALTER TABLE salaries ADD COLUMN travel_fee REAL DEFAULT 0"); } catch(_) {}
  try { db.exec("ALTER TABLE salaries ADD COLUMN rent_utility_fee REAL DEFAULT 0"); } catch(_) {}
}

function syncStores() {
  var existing = db.prepare('SELECT name FROM stores').all().map(function(r) { return r.name; });
  var toRemove = existing.filter(function(n) { return DESIRED_STORES.indexOf(n) === -1; });
  var toAdd = DESIRED_STORES.filter(function(n) { return existing.indexOf(n) === -1; });
  var del = db.prepare('DELETE FROM stores WHERE name = ?');
  var ins = db.prepare('INSERT INTO stores (name) VALUES (?)');
  toRemove.forEach(function(name) { del.run(name); });
  toAdd.forEach(function(name) { ins.run(name); });
}

function seedData() {
  var storeIds = {};
  var stores = db.prepare('SELECT id, name FROM stores').all();
  stores.forEach(function(s) { storeIds[s.name] = s.id; });
  DESIRED_STORES.forEach(function(s) {
    if (!storeIds[s]) {
      var r = db.prepare('INSERT INTO stores (name) VALUES (?)').run(s);
      storeIds[s] = r.lastInsertRowid;
    }
  });

  var today = new Date();
  var fmt = function(d) { return d.toISOString().slice(0,10); };
  var daysLater = function(n) { var d = new Date(today); d.setDate(d.getDate()+n); return fmt(d); };
  var daysBefore = function(n) { var d = new Date(today); d.setDate(d.getDate()-n); return fmt(d); };

  var artists = [
    {name:'赵晓光',g:'男',s:'胡桃里中心城',pos:['主管'],lv:'S级',ss:'全国约',sal:800,st:'在岗',id:'110101199001011234',ph:'13800001001'},
  ];

  var artistInsert = db.prepare("INSERT INTO artists (name,avatar,gender,store_id,store_name,positions,business_level,sign_status,daily_salary,status,id_card,phone) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  var contractInsert = db.prepare("INSERT INTO contracts (artist_id,artist_name,positions,brand,gender,id_card,phone,start_date,end_date,contract_no,sign_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  var evalInsert = db.prepare("INSERT INTO evaluations (artist_id,artist_name,store_name,overall_score,responsibility_score,stability_score,teamwork_score,adaptability_score,business_score,tags,comment,evaluated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");

  var artistIds = {};
  artists.forEach(function(a) {
    var posJson = JSON.stringify(a.pos);
    var r = artistInsert.run(a.name,'',a.g,storeIds[a.s],a.s,posJson,a.lv,a.ss,a.sal,a.st,a.id,a.ph);
    artistIds[a.name] = r.lastInsertRowid;
  });

  artists.forEach(function(a, i) {
    if (a.ss === '未签约') return;
    var endDate;
    if (i < 3) endDate = daysBefore(Math.floor(Math.random()*30)+1);
    else if (i < 7) endDate = daysLater(Math.floor(Math.random()*80)+10);
    else endDate = daysLater(Math.floor(Math.random()*300)+120);
    var posJson = JSON.stringify(a.pos);
    contractInsert.run(artistIds[a.name], a.name, posJson, '', a.g, a.id, a.ph, daysBefore(Math.floor(Math.random()*365)+30), endDate, 'HT' + String(20260000 + i + 1), a.ss);
  });

  var evals = [
    {n:'赵晓光',s:'胡桃里中心城',sc:4.8,t:['领导力强','经验丰富'],c:'综合管理能力突出',d:daysBefore(5)},
  ];
  evals.forEach(function(e) {
    if (artistIds[e.n]) {
      evalInsert.run(artistIds[e.n], e.n, e.s, e.sc, Math.round(e.sc), Math.round(e.sc), Math.round(e.sc), Math.round(e.sc), Math.round(e.sc), JSON.stringify(e.t), e.c, e.d + ' 10:00:00');
    }
  });
}

// ===== Query helpers =====

function getAllData() {
  var artists = db.prepare("SELECT * FROM artists WHERE COALESCE(status,'') != '-1'").all();
  var contracts = db.prepare('SELECT * FROM contracts').all();
  var evaluations = db.prepare('SELECT * FROM evaluations ORDER BY evaluated_at DESC').all();
  var stores = db.prepare('SELECT * FROM stores').all();
  var salaries = db.prepare('SELECT * FROM salaries ORDER BY created_at DESC').all();

  return {
    artists: (artists || []).map(mapArtist),
    contracts: (contracts || []).map(mapContract),
    evaluations: (evaluations || []).map(mapEvaluation),
    stores: (stores || []).map(function(s) { return s.name; }),
    salaries: (salaries || []).map(mapSalary)
  };
}

function addArtist(data) {
  var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
  var r = db.prepare(
    "INSERT INTO artists (name, avatar, status, business_level, store_name, positions, sign_status, daily_salary) VALUES (?,?,?,?,?,?,?,?)"
  ).run(data.name, data.avatar || '', data.status || '在岗', data.level || 'B级', data.store || '', posJson, data.contractStatus || '未签约', data.dailySalary || 0);
  return { id: r.lastInsertRowid };
}

function updateArtist(data) {
  var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
  db.prepare(
    "UPDATE artists SET name=?, avatar=?, status=?, business_level=?, store_name=?, positions=?, sign_status=?, daily_salary=?, updated_at=datetime('now','localtime') WHERE id=?"
  ).run(data.name, data.avatar || '', data.status || '在岗', data.level || 'B级', data.store || '', posJson, data.contractStatus || '未签约', data.dailySalary || 0, data.id);
  return {};
}

function deleteArtist(id) {
  db.prepare("UPDATE artists SET status = '-1' WHERE id = ?").run(id);
  return {};
}

function addContract(data) {
  var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
  var r = db.prepare(
    "INSERT INTO contracts (artist_id, artist_name, positions, brand, gender, id_card, phone, start_date, end_date, contract_no, sign_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  ).run(0, data.name, posJson, data.brand || '', data.gender || '', data.idNumber || '', data.phone || '', data.startDate || '', data.endDate || '', data.contractNo || '', data.signStatus || '未签约');
  return { id: r.lastInsertRowid };
}

function updateContract(data) {
  var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
  db.prepare(
    "UPDATE contracts SET artist_name=?, positions=?, brand=?, gender=?, id_card=?, phone=?, start_date=?, end_date=?, contract_no=?, sign_status=? WHERE id=?"
  ).run(data.name, posJson, data.brand || '', data.gender || '', data.idNumber || '', data.phone || '', data.startDate || '', data.endDate || '', data.contractNo || '', data.signStatus || '未签约', data.id);
  return {};
}

function addSalaries(salaryList) {
  var count = 0;
  var ins = db.prepare(
    "INSERT INTO salaries (month, store_name, nature, artist_name, position, daily_salary, performance_days, monthly_salary, team_fee, travel_fee, rent_utility_fee, total_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
  );
  var tx = db.transaction(function(list) {
    list.forEach(function(sd) {
      var total = (sd.monthlySalary || 0) + (sd.teamFee || 0) + (sd.travelFee || 0) + (sd.rentUtilityFee || 0);
      ins.run(sd.month || '', sd.store || '', sd.nature || '', sd.name || '', sd.position || '', sd.dailySalary || 0, sd.performanceDays || 0, sd.monthlySalary || 0, sd.teamFee || 0, sd.travelFee || 0, sd.rentUtilityFee || 0, total);
      count++;
    });
  });
  tx(salaryList || []);
  return { count: count };
}

function addEvaluations(evalList) {
  var count = 0;
  var ins = db.prepare(
    "INSERT INTO evaluations (artist_id, artist_name, store_name, overall_score, responsibility_score, stability_score, teamwork_score, adaptability_score, business_score, tags, comment, evaluated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
  );
  var tx = db.transaction(function(list) {
    list.forEach(function(ed) {
      ins.run(0, ed.name || '', ed.store || '', ed.overallScore || 0, ed.responsibilityScore || 0, ed.stabilityScore || 0, ed.teamworkScore || 0, ed.adaptabilityScore || 0, ed.businessScore || 0, JSON.stringify(ed.tags || []), ed.comment || '', ed.evaluatedAt || '');
      count++;
    });
  });
  tx(evalList || []);
  return { count: count };
}

function saveArtistPhotos(artistId, photosJson) {
  db.prepare("UPDATE artists SET photos=?, updated_at=datetime('now','localtime') WHERE id=?").run(photosJson || '[]', artistId);
  return {};
}

function resetAllData() {
  db.exec("DELETE FROM salaries");
  db.exec("DELETE FROM evaluations");
  db.exec("DELETE FROM contracts");
  db.exec("UPDATE artists SET status = '-1'");
  return {};
}

function saveAvatar(dataUrl, artistName) {
  var matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) throw new Error('无效的图片格式');
  var ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  var buffer = Buffer.from(matches[2], 'base64');
  var avatarDir = path.join(__dirname, '..', 'src', 'assets', 'avatars');
  if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
  var fileName = artistName + '_' + Date.now() + '.' + ext;
  fs.writeFileSync(path.join(avatarDir, fileName), buffer);
  return 'assets/avatars/' + fileName;
}

// ===== Mapping helpers (same output shape as main.js IPC) =====

function mapArtist(a) {
  return {
    id: a.id, name: a.name,
    avatar: a.avatar || 'https://picsum.photos/id/' + (a.id + 10) + '/40/40',
    photos: a.photos || '[]',
    status: a.status || '在岗', level: a.business_level || 'B级',
    store: a.store_name || '',
    position: a.positions ? JSON.parse(a.positions).join(', ') : '',
    contractStatus: a.sign_status || '未签约',
    dailySalary: a.daily_salary || 0
  };
}

function mapContract(c) {
  return {
    id: c.id, artistId: c.artist_id, artistName: c.artist_name || '',
    position: c.positions ? JSON.parse(c.positions).join(', ') : '',
    brand: c.brand || '', gender: c.gender || '', idNumber: c.id_card || '',
    phone: c.phone || '', startDate: c.start_date || '', endDate: c.end_date || '',
    contractNumber: c.contract_no || '', status: c.sign_status || '未签约'
  };
}

function mapEvaluation(e) {
  return {
    id: e.id, artistId: e.artist_id, artistName: e.artist_name || '',
    storeName: e.store_name || '', overallScore: e.overall_score || 0,
    responsibilityScore: e.responsibility_score || 0,
    stabilityScore: e.stability_score || 0,
    teamworkScore: e.teamwork_score || 0,
    adaptabilityScore: e.adaptability_score || 0,
    businessScore: e.business_score || 0,
    tags: e.tags ? JSON.parse(e.tags) : [],
    comment: e.comment || '',
    evaluatedAt: e.evaluated_at ? e.evaluated_at.slice(0, 10) : ''
  };
}

function mapSalary(s) {
  return {
    id: s.id, month: s.month || '', store: s.store_name || '',
    nature: s.nature || '', name: s.artist_name || '', position: s.position || '',
    dailySalary: s.daily_salary || 0, performanceDays: s.performance_days || 0,
    monthlySalary: s.monthly_salary || 0, teamFee: s.team_fee || 0,
    travelFee: s.travel_fee || 0, rentUtilityFee: s.rent_utility_fee || 0,
    totalAmount: s.total_amount || 0
  };
}

module.exports = {
  init,
  getAllData,
  addArtist, updateArtist, deleteArtist,
  addContract, updateContract,
  addSalaries, addEvaluations,
  saveArtistPhotos, saveAvatar,
  resetAllData
};

ENDOFDATABASE

cat > /app/package.json << 'ENDOFPKG'
{
  "name": "artist-manager-server",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "better-sqlite3": "^12.9.0",
    "cors": "^2.8.6",
    "express": "^5.2.1"
  }
}
ENDOFPKG

echo "=== Installing dependencies ==="
cd /app && npm install

echo "=== Setting up data directory ==="
mkdir -p /app/data

echo "=== Stopping old server ==="
pkill -f "node /app/server.js" 2>/dev/null || true
sleep 1

echo "=== Starting server on port 8080 ==="
nohup env PORT=8080 DB_PATH=/app/data/artist_data.db node /app/server.js > /app/server.log 2>&1 &

sleep 2
echo "=== Server status ==="
ps aux | grep "node /app/server" | grep -v grep || echo "Server failed to start, check /app/server.log"
echo ""
echo "=== Deploy complete! ==="
