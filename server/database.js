const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

var DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'artist_data.db');

var db;

var DESIRED_STORES = ['胡桃里中心城','胡桃里时代城','18般罗湖店','18般广州店','Ahouse厦门店','Ahouse无锡店','南宁见山谣','南宁滚滚','昆明滚滚','昆明Bongbong','海口苏荷','成都俏皮狗'];

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
  try { db.exec("ALTER TABLE artists ADD COLUMN videos TEXT DEFAULT '[]'"); } catch(_) {}
  try { db.exec("ALTER TABLE artists ADD COLUMN age INTEGER DEFAULT 0"); } catch(_) {}
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
  db.exec("CREATE TABLE IF NOT EXISTS reserve_artists (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    name TEXT NOT NULL,\n    avatar TEXT DEFAULT '',\n    gender TEXT DEFAULT '',\n    age INTEGER DEFAULT 0,\n    height TEXT DEFAULT '',\n    region TEXT DEFAULT '',\n    positions TEXT DEFAULT '[]',\n    business_level TEXT DEFAULT 'C级',\n    daily_salary REAL DEFAULT 0,\n    phone TEXT DEFAULT '',\n    status TEXT DEFAULT '待定',\n    evaluator TEXT DEFAULT '',\n    evaluation_content TEXT DEFAULT '',\n    experience TEXT DEFAULT '',\n    photos TEXT DEFAULT '[]',\n    videos TEXT DEFAULT '[]',\n    created_at TEXT DEFAULT (datetime('now','localtime')),\n    updated_at TEXT DEFAULT (datetime('now','localtime'))\n  )");
  try { db.exec("ALTER TABLE reserve_artists ADD COLUMN linked_artist_id INTEGER DEFAULT NULL"); } catch(_) {}
  try { db.exec("ALTER TABLE artists ADD COLUMN linked_reserve_id INTEGER DEFAULT NULL"); } catch(_) {}
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
  var artists = db.prepare("SELECT id,name,avatar,status,business_level,store_name,positions,sign_status,daily_salary,linked_reserve_id,gender,id_card,age,phone FROM artists WHERE COALESCE(status,'') != '-1'").all();
  var contracts = db.prepare('SELECT * FROM contracts').all();
  var evaluations = db.prepare('SELECT * FROM evaluations ORDER BY evaluated_at DESC').all();
  var stores = db.prepare('SELECT * FROM stores').all();
  var salaries = db.prepare('SELECT * FROM salaries ORDER BY created_at DESC').all();

  var announcements = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
  var reserveArtists = db.prepare("SELECT * FROM reserve_artists WHERE COALESCE(status,'') != '-1'").all();

  return {
    artists: (artists || []).map(mapArtist),
    contracts: (contracts || []).map(mapContract),
    evaluations: (evaluations || []).map(mapEvaluation),
    stores: (stores || []).map(function(s) { return s.name; }),
    salaries: (salaries || []).map(mapSalary),
    announcements: (announcements || []).map(mapAnnouncement),
    reserveArtists: (reserveArtists || []).map(mapReserveArtist)
  };
}

function getArtistMedia(artistId) {
  var row = db.prepare('SELECT photos, videos FROM artists WHERE id = ?').get(artistId);
  if (!row) return { photos: '[]', videos: '[]' };
  return { photos: row.photos || '[]', videos: row.videos || '[]' };
}

function addArtist(data) {
  var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
  var r = db.prepare(
    "INSERT INTO artists (name, avatar, status, business_level, store_name, positions, sign_status, daily_salary, phone, gender, id_card) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  ).run(data.name, data.avatar || '', data.status || '在岗', data.level || 'B级', data.store || '', posJson, data.contractStatus || '未签约', data.dailySalary || 0, data.phone || '', data.gender || '', data.idNumber || '');
  return { id: r.lastInsertRowid };
}

function updateArtist(data) {
  var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
  // Preserve existing phone/gender/id_card/age when not provided (avoid wiping synced data)
  var existing = db.prepare('SELECT phone, gender, id_card, age FROM artists WHERE id = ?').get(data.id);
  var phone = data.phone !== undefined && data.phone !== null && data.phone !== '' ? data.phone : (existing ? existing.phone || '' : '');
  var gender = data.gender !== undefined && data.gender !== null && data.gender !== '' ? data.gender : (existing ? existing.gender || '' : '');
  var idCard = data.idNumber !== undefined && data.idNumber !== null && data.idNumber !== '' ? data.idNumber : (existing ? existing.id_card || '' : '');
  var age = data.age !== undefined && data.age !== null && data.age !== '' ? data.age : (existing ? existing.age || 0 : 0);
  db.prepare(
    "UPDATE artists SET name=?, avatar=?, status=?, business_level=?, store_name=?, positions=?, sign_status=?, daily_salary=?, phone=?, gender=?, id_card=?, age=?, updated_at=datetime('now','localtime') WHERE id=?"
  ).run(data.name, data.avatar || '', data.status || '在岗', data.level || 'B级', data.store || '', posJson, data.contractStatus || '未签约', data.dailySalary || 0, phone, gender, idCard, age, data.id);
  // 状态改为"待岗" → 自动同步到艺人储备库
  if (data.status === '待岗') {
    var row = db.prepare('SELECT * FROM artists WHERE id = ?').get(data.id);
    if (row) {
      syncArtistToReserve(row);
      db.prepare("UPDATE artists SET status = '-1', updated_at=datetime('now','localtime') WHERE id = ?").run(data.id);
    }
  }
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

function getAnnouncementFilePath(id) {
  var row = db.prepare('SELECT file_path FROM announcements WHERE id = ?').get(id);
  if (!row || !row.file_path) return '';
  return path.join(__dirname, 'src', row.file_path);
}

function getAnnouncementFileBase64(id) {
  var fullPath = getAnnouncementFilePath(id);
  if (!fullPath || !fs.existsSync(fullPath)) return '';
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

function mapReserveArtist(a) {
  return {
    id: a.id, name: a.name,
    avatar: a.avatar || '', gender: a.gender || '',
    age: a.age || 0, height: a.height || '', region: a.region || '',
    position: (function() {
      try { return JSON.parse(a.positions || '[]').join(', '); } catch(_) { return a.positions || ''; }
    })(),
    level: a.business_level || 'C级', dailySalary: a.daily_salary || 0,
    phone: a.phone || '', status: a.status || '待定',
    evaluator: a.evaluator || '', evaluationContent: a.evaluation_content || '',
    experience: a.experience || '', photos: a.photos || '[]', videos: a.videos || '[]',
    createdAt: a.created_at ? a.created_at.slice(0, 19) : '',
    updatedAt: a.updated_at ? a.updated_at.slice(0, 19) : ''
  };
}

// ===== 双向同步：艺人信息库 ↔ 艺人储备库 =====

function syncReserveToArtist(reserveRow) {
  var posStr = '';
  try { posStr = JSON.parse(reserveRow.positions || '[]').join(', '); } catch(_) {}
  var linkedId = reserveRow.linked_artist_id || null;
  if (linkedId) {
    // Update existing linked artist (only sync shared fields, don't overwrite store/sign_status)
    db.prepare(
      "UPDATE artists SET name=?, avatar=?, gender=?, age=?, business_level=?, positions=?, daily_salary=?, phone=?, photos=?, videos=?, status='在岗', updated_at=datetime('now','localtime') WHERE id=?"
    ).run(reserveRow.name, reserveRow.avatar || '', reserveRow.gender || '',
      reserveRow.age || 0, reserveRow.business_level || 'B+级', reserveRow.positions || '[]',
      reserveRow.daily_salary || 0, reserveRow.phone || '',
      reserveRow.photos || '[]', reserveRow.videos || '[]', linkedId);
    return linkedId;
  }
  // Create new artist record
  var result = db.prepare(
    "INSERT INTO artists (name, avatar, gender, age, store_name, positions, business_level, sign_status, daily_salary, phone, photos, videos, status, linked_reserve_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(reserveRow.name, reserveRow.avatar || '', reserveRow.gender || '', reserveRow.age || 0, '',
    reserveRow.positions || '[]', reserveRow.business_level || 'B+级', '未签约',
    reserveRow.daily_salary || 0, reserveRow.phone || '',
    reserveRow.photos || '[]', reserveRow.videos || '[]', '在岗', reserveRow.id);
  // Write link back to reserve record
  db.prepare('UPDATE reserve_artists SET linked_artist_id=? WHERE id=?').run(result.lastInsertRowid, reserveRow.id);
  return result.lastInsertRowid;
}

function syncArtistToReserve(artistRow) {
  var linkedId = artistRow.linked_reserve_id || null;
  // Preserve experience from linked reserve record if it exists
  var prevExperience = '';
  if (linkedId) {
    var prev = db.prepare('SELECT experience FROM reserve_artists WHERE id = ?').get(linkedId);
    if (prev) prevExperience = prev.experience || '';
  }
  if (linkedId) {
    // Update existing linked reserve record
    db.prepare(
      "UPDATE reserve_artists SET name=?, avatar=?, gender=?, age=?, business_level=?, positions=?, daily_salary=?, phone=?, photos=?, videos=?, experience=?, status='待定', updated_at=datetime('now','localtime') WHERE id=?"
    ).run(artistRow.name, artistRow.avatar || '', artistRow.gender || '',
      artistRow.age || 0, artistRow.business_level || 'B级', artistRow.positions || '[]',
      artistRow.daily_salary || 0, artistRow.phone || '',
      artistRow.photos || '[]', artistRow.videos || '[]', prevExperience, linkedId);
    return linkedId;
  }
  // Create new reserve record
  var result = db.prepare(
    "INSERT INTO reserve_artists (name, avatar, gender, age, height, region, positions, business_level, daily_salary, phone, photos, videos, status, experience, linked_artist_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(artistRow.name, artistRow.avatar || '', artistRow.gender || '', artistRow.age || 0, '', '',
    artistRow.positions || '[]', artistRow.business_level || 'B级',
    artistRow.daily_salary || 0, artistRow.phone || '',
    artistRow.photos || '[]', artistRow.videos || '[]', '待定', prevExperience, artistRow.id);
  // Write link back to artist record
  db.prepare('UPDATE artists SET linked_reserve_id=? WHERE id=?').run(result.lastInsertRowid, artistRow.id);
  return result.lastInsertRowid;
}

function saveAvatar(dataUrl, artistName) {
  var matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) throw new Error('无效的图片格式');
  var ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  var buffer = Buffer.from(matches[2], 'base64');
  var avatarDir = path.join(__dirname, '..', 'src', 'assets', 'avatars');
  if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
  // Sanitize artistName to prevent path traversal
  var safeName = String(artistName || 'unknown').replace(/[\/\\\.]{2,}/g, '_').replace(/[\/\\]/g, '_').slice(0, 100);
  var fileName = safeName + '_' + Date.now() + '.' + ext;
  fs.writeFileSync(path.join(avatarDir, fileName), buffer);
  return 'assets/avatars/' + fileName;
}

// ===== Mapping helpers (same output shape as main.js IPC) =====

function mapArtist(a) {
  return {
    id: a.id, name: a.name,
    avatar: a.avatar || 'https://picsum.photos/id/' + (a.id + 10) + '/40/40',
    photos: '[]',
    videos: '[]',
    status: a.status || '在岗', level: a.business_level || 'B级',
    store: a.store_name || '',
    position: a.positions ? JSON.parse(a.positions).join(', ') : '',
    contractStatus: a.sign_status || '未签约',
    dailySalary: a.daily_salary || 0,
    phone: a.phone || '',
    gender: a.gender || '',
    idNumber: a.id_card || '',
    age: a.age || 0,
    linkedReserveId: a.linked_reserve_id || null
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

function convertToH264(filePath) {
  var ext = path.extname(filePath).toLowerCase();
  // Only process video files
  if (['.mp4','.mov','.avi','.mkv','.webm','.m4v','.3gp'].indexOf(ext) === -1) return filePath;

  var codec = '';
  try {
    codec = execSync(
      'ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "' + filePath + '"',
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
  } catch(_) {
    // ffprobe not available — try faststart remux anyway
  }

  var tmpPath = filePath.replace(/\.\w+$/, '_conv.mp4');

  if (codec === 'hevc' || codec === 'hvc1' || codec === 'hev1') {
    // HEVC/H.265: re-encode to H.264 + faststart
    try {
      execSync(
        'ffmpeg -i "' + filePath + '" -c:v libx264 -c:a aac -movflags +faststart -y "' + tmpPath + '"',
        { encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      fs.unlinkSync(filePath);
      fs.renameSync(tmpPath, filePath);
    } catch(_) {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  } else {
    // All other formats: faststart remux only (no re-encode, ~1-2 seconds)
    // This moves the moov atom to the front so playback can start immediately
    try {
      execSync(
        'ffmpeg -i "' + filePath + '" -c copy -movflags +faststart -y "' + tmpPath + '"',
        { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      // Only replace original if remux was successful and output is not empty
      if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 0) {
        fs.unlinkSync(filePath);
        fs.renameSync(tmpPath, filePath);
      }
    } catch(_) {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }
  return filePath;
}

function saveArtistVideo(artistId, dataUrl, fileName) {
  var matches = dataUrl.match(/^data:video\/(\w+);base64,(.+)$/);
  if (!matches) throw new Error('无效的视频格式');
  var ext = matches[1];
  if (ext === 'quicktime') ext = 'mov';
  var buffer = Buffer.from(matches[2], 'base64');
  var videoDir = path.join(__dirname, 'src', 'assets', 'videos');
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
  var videoId = 'v_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  var safeName = videoId + '.' + ext;
  var fullPath = path.join(videoDir, safeName);
  fs.writeFileSync(fullPath, buffer);
  convertToH264(fullPath);
  var fileSize = fs.statSync(fullPath).size;
  var relativePath = 'assets/videos/' + safeName;
  var row = db.prepare('SELECT videos FROM artists WHERE id = ?').get(artistId);
  if (!row) throw new Error('艺人不存在');
  var videos = [];
  try { videos = JSON.parse(row.videos || '[]'); } catch(_) {}
  videos.push({
    id: videoId,
    fileName: fileName,
    serverPath: relativePath,
    size: fileSize,
    mimeType: 'video/mp4',
    uploadedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
  });
  db.prepare("UPDATE artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?")
    .run(JSON.stringify(videos), artistId);
  return relativePath;
}

function saveArtistVideos(artistId, videosJson) {
  db.prepare("UPDATE artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?")
    .run(videosJson || '[]', artistId);
}

function deleteArtistVideo(artistId, videoId) {
  var row = db.prepare('SELECT videos FROM artists WHERE id = ?').get(artistId);
  if (!row) return;
  var videos = [];
  try { videos = JSON.parse(row.videos || '[]'); } catch(_) {}
  var remaining = [];
  var deleted = null;
  for (var i = 0; i < videos.length; i++) {
    if (videos[i].id === videoId) { deleted = videos[i]; }
    else { remaining.push(videos[i]); }
  }
  if (deleted && deleted.serverPath) {
    var fullPath = path.join(__dirname, 'src', deleted.serverPath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
  db.prepare("UPDATE artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?")
    .run(JSON.stringify(remaining), artistId);
}

function getVideoStreamInfo(artistId, videoId) {
  var row = db.prepare('SELECT videos FROM artists WHERE id = ?').get(artistId);
  if (!row) return null;
  var videos = [];
  try { videos = JSON.parse(row.videos || '[]'); } catch(_) {}
  for (var i = 0; i < videos.length; i++) {
    if (videos[i].id === videoId) return videos[i];
  }
  return null;
}

function saveReserveVideo(id, dataUrl, fileName) {
  var matches = dataUrl.match(/^data:video\/(\w+);base64,(.+)$/);
  if (!matches) throw new Error('无效的视频格式');
  var ext = matches[1];
  if (ext === 'quicktime') ext = 'mov';
  var buffer = Buffer.from(matches[2], 'base64');
  var videoDir = path.join(__dirname, 'src', 'assets', 'videos');
  if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
  var videoId = 'rv_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  var safeName = videoId + '.' + ext;
  var fullPath = path.join(videoDir, safeName);
  fs.writeFileSync(fullPath, buffer);
  convertToH264(fullPath);
  var fileSize = fs.statSync(fullPath).size;
  var relativePath = 'assets/videos/' + safeName;
  var row = db.prepare('SELECT videos FROM reserve_artists WHERE id = ?').get(id);
  if (!row) throw new Error('储备艺人不存在');
  var videos = [];
  try { videos = JSON.parse(row.videos || '[]'); } catch(_) {}
  videos.push({
    id: videoId,
    fileName: fileName,
    serverPath: relativePath,
    size: fileSize,
    mimeType: 'video/mp4',
    uploadedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
  });
  db.prepare("UPDATE reserve_artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?")
    .run(JSON.stringify(videos), id);
  return { id: videoId, path: relativePath, size: fileSize };
}

function deleteReserveVideo(id, videoId) {
  var row = db.prepare('SELECT videos FROM reserve_artists WHERE id = ?').get(id);
  if (!row) return;
  var videos = [];
  try { videos = JSON.parse(row.videos || '[]'); } catch(_) {}
  var remaining = [];
  var deleted = null;
  for (var i = 0; i < videos.length; i++) {
    if (videos[i].id === videoId) { deleted = videos[i]; }
    else { remaining.push(videos[i]); }
  }
  if (deleted && deleted.serverPath) {
    var fullPath = path.join(__dirname, 'src', deleted.serverPath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
  db.prepare("UPDATE reserve_artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?")
    .run(JSON.stringify(remaining), id);
}

function getReserveVideoStreamInfo(id, videoId) {
  var row = db.prepare('SELECT videos FROM reserve_artists WHERE id = ?').get(id);
  if (!row) return null;
  var videos = [];
  try { videos = JSON.parse(row.videos || '[]'); } catch(_) {}
  for (var i = 0; i < videos.length; i++) {
    if (videos[i].id === videoId) return videos[i];
  }
  return null;
}

// ===== Reserve Artist CRUD =====

function addReserveArtist(data) {
  var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
  var r = db.prepare(
    "INSERT INTO reserve_artists (name, avatar, gender, age, height, region, positions, business_level, daily_salary, phone, status, evaluator, evaluation_content, experience) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(data.name, data.avatar || '', data.gender || '', data.age || 0, data.height || '', data.region || '',
    posJson, data.level || 'C级', data.dailySalary || 0, data.phone || '', data.status || '待定',
    data.evaluator || '', data.evaluationContent || '', data.experience || '');
  return { id: r.lastInsertRowid };
}

function updateReserveArtist(data) {
  var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
  // Preserve existing experience when not provided (avoid wiping on status change)
  var existingExp = db.prepare('SELECT experience FROM reserve_artists WHERE id = ?').get(data.id);
  var experience = data.experience !== undefined && data.experience !== null && data.experience !== '' ? data.experience : (existingExp ? existingExp.experience || '' : '');
  db.prepare(
    "UPDATE reserve_artists SET name=?, avatar=?, gender=?, age=?, height=?, region=?, positions=?, business_level=?, daily_salary=?, phone=?, status=?, evaluator=?, evaluation_content=?, experience=?, updated_at=datetime('now','localtime') WHERE id=?"
  ).run(data.name, data.avatar || '', data.gender || '', data.age || 0, data.height || '', data.region || '',
    posJson, data.level || 'C级', data.dailySalary || 0, data.phone || '', data.status || '待定',
    data.evaluator || '', data.evaluationContent || '', experience, data.id);
  // 状态改为"已安排" → 自动同步到艺人信息库
  if (data.status === '已安排') {
    var row = db.prepare('SELECT * FROM reserve_artists WHERE id = ?').get(data.id);
    if (row) {
      syncReserveToArtist(row);
      db.prepare("UPDATE reserve_artists SET status = '-1', updated_at=datetime('now','localtime') WHERE id = ?").run(data.id);
    }
  }
}

function deleteReserveArtist(id) {
  db.prepare("UPDATE reserve_artists SET status = '-1' WHERE id = ?").run(id);
}

function saveReservePhotos(id, photosJson) {
  db.prepare("UPDATE reserve_artists SET photos=?, updated_at=datetime('now','localtime') WHERE id=?").run(photosJson || '[]', id);
}

function saveReserveVideos(id, videosJson) {
  db.prepare("UPDATE reserve_artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?").run(videosJson || '[]', id);
}

function saveReserveExperience(id, experience) {
  db.prepare("UPDATE reserve_artists SET experience=?, updated_at=datetime('now','localtime') WHERE id=?").run(experience || '', id);
}

function batchAddReserveArtists(list) {
  var count = 0;
  var stmt = db.prepare(
    "INSERT INTO reserve_artists (name, avatar, gender, age, height, region, positions, business_level, daily_salary, phone, status, evaluator, evaluation_content) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
  );
  list.forEach(function(item) {
    var posJson = JSON.stringify((item.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
    stmt.run(item.name || '', '', item.gender || '', parseInt(item.age) || 0, item.height || '', item.region || '',
      posJson, item.level || 'C级', parseFloat(item.dailySalary) || 0, item.phone || '',
      item.status || '待定', item.evaluator || '', item.evaluationContent || '');
    count++;
  });
  return { count: count };
}

module.exports = {
  init,
  getAllData,
  getArtistMedia,
  addArtist, updateArtist, deleteArtist,
  addContract, updateContract, getContractFileBase64,
  addSalaries, addEvaluations,
  saveArtistPhotos, saveAvatar,
  resetAllData,
  addAnnouncement, deleteAnnouncement, getAnnouncementFileBase64, getAnnouncementFilePath,
  saveArtistVideo, saveArtistVideos, deleteArtistVideo, getVideoStreamInfo,
  getReserveVideoStreamInfo,
  saveReserveVideo, deleteReserveVideo,
  addReserveArtist, updateReserveArtist, deleteReserveArtist,
  saveReservePhotos, saveReserveVideos, saveReserveExperience,
  batchAddReserveArtists
};
