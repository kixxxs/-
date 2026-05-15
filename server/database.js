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
  db.exec("CREATE TABLE IF NOT EXISTS contracts (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    artist_id INTEGER NOT NULL,\n    artist_name TEXT DEFAULT '',\n    positions TEXT DEFAULT '[]',\n    brand TEXT DEFAULT '',\n    gender TEXT DEFAULT '',\n    id_card TEXT DEFAULT '',\n    phone TEXT DEFAULT '',\n    start_date TEXT DEFAULT '',\n    end_date TEXT DEFAULT '',\n    contract_no TEXT DEFAULT '',\n    sign_status TEXT DEFAULT '未签约',\n    contract_file TEXT DEFAULT '',\n    created_at TEXT DEFAULT (datetime('now','localtime'))\n  )");
  try { db.exec("ALTER TABLE contracts ADD COLUMN contract_file TEXT DEFAULT ''"); } catch(_) {}
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
  db.exec("CREATE TABLE IF NOT EXISTS announcements (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    title TEXT NOT NULL DEFAULT '',\n    file_name TEXT DEFAULT '',\n    file_path TEXT DEFAULT '',\n    created_at TEXT DEFAULT (datetime('now','localtime'))\n  )");
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

  var announcements = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();

  return {
    artists: (artists || []).map(mapArtist),
    contracts: (contracts || []).map(mapContract),
    evaluations: (evaluations || []).map(mapEvaluation),
    stores: (stores || []).map(function(s) { return s.name; }),
    salaries: (salaries || []).map(mapSalary),
    announcements: (announcements || []).map(mapAnnouncement)
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
  var contractFile = saveContractFileToDisk(data.contractFile);
  var r = db.prepare(
    "INSERT INTO contracts (artist_id, artist_name, positions, brand, gender, id_card, phone, start_date, end_date, contract_no, sign_status, contract_file) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(0, data.name, posJson, data.brand || '', data.gender || '', data.idNumber || '', data.phone || '', data.startDate || '', data.endDate || '', data.contractNo || '', data.signStatus || '未签约', contractFile);
  return { id: r.lastInsertRowid };
}

function updateContract(data) {
  var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
  var contractFile = data.contractFile;
  var hasNewFile = contractFile && contractFile.startsWith('data:application/pdf;base64,');
  if (hasNewFile) {
    contractFile = saveContractFileToDisk(contractFile);
    db.prepare(
      "UPDATE contracts SET artist_name=?, positions=?, brand=?, gender=?, id_card=?, phone=?, start_date=?, end_date=?, contract_no=?, sign_status=?, contract_file=? WHERE id=?"
    ).run(data.name, posJson, data.brand || '', data.gender || '', data.idNumber || '', data.phone || '', data.startDate || '', data.endDate || '', data.contractNo || '', data.signStatus || '未签约', contractFile, data.id);
  } else {
    db.prepare(
      "UPDATE contracts SET artist_name=?, positions=?, brand=?, gender=?, id_card=?, phone=?, start_date=?, end_date=?, contract_no=?, sign_status=? WHERE id=?"
    ).run(data.name, posJson, data.brand || '', data.gender || '', data.idNumber || '', data.phone || '', data.startDate || '', data.endDate || '', data.contractNo || '', data.signStatus || '未签约', data.id);
  }
  return {};
}

function saveContractFileToDisk(contractFile) {
  if (!contractFile || !contractFile.startsWith('data:application/pdf;base64,')) return contractFile || '';
  var matches = contractFile.match(/^data:application\/pdf;base64,(.+)$/);
  if (!matches) return '';
  var buffer = Buffer.from(matches[1], 'base64');
  var pdfDir = path.join(__dirname, 'src', 'assets', 'contracts');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  var fileName = 'contract_svr_' + Date.now() + '.pdf';
  fs.writeFileSync(path.join(pdfDir, fileName), buffer);
  return 'assets/contracts/' + fileName;
}

function getContractFileBase64(filePath) {
  if (!filePath) return '';
  var fullPath = path.join(__dirname, 'src', filePath);
  if (!fs.existsSync(fullPath)) return '';
  var buffer = fs.readFileSync(fullPath);
  return 'data:application/pdf;base64,' + buffer.toString('base64');
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
  db.exec("DELETE FROM announcements");
  db.exec("UPDATE artists SET status = '-1'");
  return {};
}

function addAnnouncement(data) {
  var filePath = '';
  if (data.fileData && data.fileData.startsWith('data:application/pdf;base64,')) {
    filePath = saveAnnouncementFileToDisk(data.fileData, data.fileName);
  }
  var r = db.prepare(
    "INSERT INTO announcements (title, file_name, file_path) VALUES (?,?,?)"
  ).run(data.title || '', data.fileName || '', filePath);
  return { id: r.lastInsertRowid };
}

function deleteAnnouncement(id) {
  var row = db.prepare('SELECT file_path FROM announcements WHERE id = ?').get(id);
  if (row && row.file_path) {
    var fullPath = path.join(__dirname, 'src', row.file_path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  return {};
}

function getAnnouncementFileBase64(id) {
  var row = db.prepare('SELECT file_path FROM announcements WHERE id = ?').get(id);
  if (!row || !row.file_path) return '';
  var fullPath = path.join(__dirname, 'src', row.file_path);
  if (!fs.existsSync(fullPath)) return '';
  var buffer = fs.readFileSync(fullPath);
  return 'data:application/pdf;base64,' + buffer.toString('base64');
}

function saveAnnouncementFileToDisk(fileData, fileName) {
  var matches = fileData.match(/^data:application\/pdf;base64,(.+)$/);
  if (!matches) return '';
  var buffer = Buffer.from(matches[1], 'base64');
  var pdfDir = path.join(__dirname, 'src', 'assets', 'announcements');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  var safeName = fileName.replace(/[^a-zA-Z0-9_\-一-龥]/g, '_');
  var filePath = 'assets/announcements/' + Date.now() + '_' + safeName;
  fs.writeFileSync(path.join(__dirname, 'src', filePath), buffer);
  return filePath;
}

function mapAnnouncement(a) {
  return {
    id: a.id,
    title: a.title || '',
    fileName: a.file_name || '',
    filePath: a.file_path || '',
    createdAt: a.created_at ? a.created_at.slice(0, 19) : ''
  };
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
    contractNumber: c.contract_no || '', status: c.sign_status || '未签约',
    contractFile: c.contract_file || ''
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
  addContract, updateContract, getContractFileBase64,
  addSalaries, addEvaluations,
  saveArtistPhotos, saveAvatar,
  resetAllData,
  addAnnouncement, deleteAnnouncement, getAnnouncementFileBase64
};
