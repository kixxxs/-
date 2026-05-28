const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db;
var DB_PATH;

// 尝试获取 Electron 的 userData 路径，确保打包后数据库可写
function getDbPath() {
  if (DB_PATH) return DB_PATH;
  try {
    var electron = require('electron');
    if (electron.app) {
      DB_PATH = path.join(electron.app.getPath('userData'), 'artist_data.db');
    }
  } catch (_) {}
  if (!DB_PATH) {
    DB_PATH = path.join(__dirname, 'artist_data.db');
  }
  return DB_PATH;
}

async function init() {
  const SQL = await initSqlJs({
    locateFile: function(file) {
      return path.join(path.dirname(require.resolve('sql.js')), file);
    }
  });

  if (fs.existsSync(getDbPath())) {
    const buffer = fs.readFileSync(getDbPath());
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  createTables();
  syncStores();

  const rows = execSelect("SELECT COUNT(*) AS c FROM artists");
  if (rows.length === 0 || rows[0].c === 0) seedData();

  saveDb();
}

var DESIRED_STORES = ['胡桃里中心城','胡桃里时代城','18般罗湖店','18般广州店','Ahouse厦门店','Ahouse无锡店','南宁见山谣','南宁滚滚','昆明滚滚','昆明Bongbong','海口苏荷','成都俏皮狗'];

function syncStores() {
  // 获取当前数据库中的门店名
  var existing = execSelect('SELECT name FROM stores').map(function(r) { return r.name; });
  // 需要删除的旧门店（数据库中有但目标列表没有的）
  var toRemove = existing.filter(function(n) { return DESIRED_STORES.indexOf(n) === -1; });
  // 需要新增的门店（目标列表中有但数据库没有的）
  var toAdd = DESIRED_STORES.filter(function(n) { return existing.indexOf(n) === -1; });

  toRemove.forEach(function(name) {
    execRun("DELETE FROM stores WHERE name = ?", [name]);
  });
  toAdd.forEach(function(name) {
    execRun("INSERT INTO stores (name) VALUES (?)", [name]);
  });
}

function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    store_id INTEGER,
    store_name TEXT DEFAULT '',
    positions TEXT DEFAULT '[]',
    business_level TEXT DEFAULT 'C级',
    sign_status TEXT DEFAULT '未签约',
    daily_salary REAL DEFAULT 0,
    status TEXT DEFAULT '在岗',
    id_card TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    photos TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  try { db.run('ALTER TABLE artists ADD COLUMN photos TEXT DEFAULT \'[]\''); } catch(_) {}
  try { db.run('ALTER TABLE artists ADD COLUMN videos TEXT DEFAULT \'[]\''); } catch(_) {}
  db.run(`CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    artist_name TEXT DEFAULT '',
    positions TEXT DEFAULT '[]',
    brand TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    id_card TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    start_date TEXT DEFAULT '',
    end_date TEXT DEFAULT '',
    contract_no TEXT DEFAULT '',
    sign_status TEXT DEFAULT '未签约',
    contract_file TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  try { db.run('ALTER TABLE contracts ADD COLUMN contract_file TEXT DEFAULT \'\''); } catch(_) {}
  db.run(`CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    artist_name TEXT DEFAULT '',
    store_name TEXT DEFAULT '',
    overall_score REAL DEFAULT 0,
    responsibility_score REAL DEFAULT 0,
    stability_score REAL DEFAULT 0,
    teamwork_score REAL DEFAULT 0,
    adaptability_score REAL DEFAULT 0,
    business_score REAL DEFAULT 0,
    tags TEXT DEFAULT '[]',
    comment TEXT DEFAULT '',
    evaluated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  // Add sub-score columns to existing evaluations table (safe to ignore if already exist)
  try { db.run('ALTER TABLE evaluations ADD COLUMN responsibility_score REAL DEFAULT 0'); } catch(_) {}
  try { db.run('ALTER TABLE evaluations ADD COLUMN stability_score REAL DEFAULT 0'); } catch(_) {}
  try { db.run('ALTER TABLE evaluations ADD COLUMN teamwork_score REAL DEFAULT 0'); } catch(_) {}
  try { db.run('ALTER TABLE evaluations ADD COLUMN adaptability_score REAL DEFAULT 0'); } catch(_) {}
  try { db.run('ALTER TABLE evaluations ADD COLUMN business_score REAL DEFAULT 0'); } catch(_) {}
  db.run(`CREATE TABLE IF NOT EXISTS salaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT DEFAULT '',
    store_name TEXT DEFAULT '',
    nature TEXT DEFAULT '',
    artist_name TEXT DEFAULT '',
    position TEXT DEFAULT '',
    daily_salary REAL DEFAULT 0,
    performance_days INTEGER DEFAULT 0,
    monthly_salary REAL DEFAULT 0,
    team_fee REAL DEFAULT 0,
    travel_fee REAL DEFAULT 0,
    rent_utility_fee REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  // Migrate old salary table: add new columns if missing
  try { db.run('ALTER TABLE salaries ADD COLUMN nature TEXT DEFAULT \'\''); } catch(_) {}
  try { db.run('ALTER TABLE salaries ADD COLUMN monthly_salary REAL DEFAULT 0'); } catch(_) {}
  try { db.run('ALTER TABLE salaries ADD COLUMN team_fee REAL DEFAULT 0'); } catch(_) {}
  try { db.run('ALTER TABLE salaries ADD COLUMN travel_fee REAL DEFAULT 0'); } catch(_) {}
  try { db.run('ALTER TABLE salaries ADD COLUMN rent_utility_fee REAL DEFAULT 0'); } catch(_) {}
  db.run(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    file_name TEXT DEFAULT '',
    file_path TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS reserve_artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    age INTEGER DEFAULT 0,
    height TEXT DEFAULT '',
    region TEXT DEFAULT '',
    positions TEXT DEFAULT '[]',
    business_level TEXT DEFAULT 'C级',
    daily_salary REAL DEFAULT 0,
    phone TEXT DEFAULT '',
    status TEXT DEFAULT '待定',
    evaluator TEXT DEFAULT '',
    evaluation_content TEXT DEFAULT '',
    experience TEXT DEFAULT '',
    photos TEXT DEFAULT '[]',
    videos TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  try { db.run('ALTER TABLE reserve_artists ADD COLUMN linked_artist_id INTEGER DEFAULT NULL'); } catch(_) {}
  try { db.run('ALTER TABLE artists ADD COLUMN linked_reserve_id INTEGER DEFAULT NULL'); } catch(_) {}
}

function execSelect(sql, params) {
  if (params && params.length > 0) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }
  const result = db.exec(sql);
  if (!result || result.length === 0 || !result[0] || !result[0].values) return [];
  const { columns, values } = result[0];
  return (values || []).map(function(row) {
    var obj = {};
    columns.forEach(function(col, i) { obj[col] = row[i]; });
    return obj;
  });
}

function evalInsertLastRowId() {
  // last_insert_rowid() 必须在 db.export() (saveDb) 之前读取，
  // 因为导出会重置内部 rowid 状态
  var rows = db.exec("SELECT last_insert_rowid() AS id");
  return rows[0].values[0][0];
}

function execRun(sql, params) {
  if (params && params.length > 0) {
    var stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
  } else {
    db.run(sql);
  }
  var changes = db.getRowsModified();
  var lastId = evalInsertLastRowId();
  saveDb();
  return { changes: changes, lastInsertRowid: lastId };
}

function query(sql, params) {
  var upper = sql.trim().toUpperCase();
  if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA')) {
    return execSelect(sql, params);
  }
  return execRun(sql, params);
}

function saveDb() {
  var data = db.export();
  fs.writeFileSync(getDbPath(), Buffer.from(data));
}

function seedData() {
  var storeIds = {};
  DESIRED_STORES.forEach(function(s) {
    var r = query("INSERT INTO stores (name) VALUES (?)", [s]);
    storeIds[s] = r.lastInsertRowid;
  });

  var today = new Date();
  var fmt = function(d) { return d.toISOString().slice(0,10); };
  var daysLater = function(n) { var d = new Date(today); d.setDate(d.getDate()+n); return fmt(d); };
  var daysBefore = function(n) { var d = new Date(today); d.setDate(d.getDate()-n); return fmt(d); };

  var artists = [
    {name:'赵晓光',g:'男',s:'胡桃里中心城',pos:['主管'],lv:'S级',ss:'全国约',sal:800,st:'在岗',id:'110101199001011234',ph:'13800001001'},
  ];

  var artistIds = {};
  artists.forEach(function(a) {
    var sid = storeIds[a.s];
    var posJson = JSON.stringify(a.pos);
    var r = query(
      "INSERT INTO artists (name,avatar,gender,store_id,store_name,positions,business_level,sign_status,daily_salary,status,id_card,phone) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [a.name,'',a.g,sid,a.s,posJson,a.lv,a.ss,a.sal,a.st,a.id,a.ph]
    );
    artistIds[a.name] = r.lastInsertRowid;
  });

  artists.forEach(function(a, i) {
    if (a.ss === '未签约') return;
    var endDate;
    if (i < 3) endDate = daysBefore(Math.floor(Math.random()*30)+1);
    else if (i < 7) endDate = daysLater(Math.floor(Math.random()*80)+10);
    else endDate = daysLater(Math.floor(Math.random()*300)+120);

    var posJson = JSON.stringify(a.pos);
    query(
      "INSERT INTO contracts (artist_id,artist_name,positions,brand,gender,id_card,phone,start_date,end_date,contract_no,sign_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [artistIds[a.name], a.name, posJson, '', a.g, a.id, a.ph,
       daysBefore(Math.floor(Math.random()*365)+30), endDate,
       'HT' + String(20260000 + i + 1), a.ss]
    );
  });

  var evals = [
    {n:'赵晓光',s:'胡桃里中心城',sc:4.8,t:['领导力强','经验丰富'],c:'综合管理能力突出',d:daysBefore(5)},
  ];
  evals.forEach(function(e) {
    if (artistIds[e.n]) {
      query(
        "INSERT INTO evaluations (artist_id,artist_name,store_name,overall_score,responsibility_score,stability_score,teamwork_score,adaptability_score,business_score,tags,comment,evaluated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [artistIds[e.n], e.n, e.s, e.sc, Math.round(e.sc), Math.round(e.sc), Math.round(e.sc), Math.round(e.sc), Math.round(e.sc), JSON.stringify(e.t), e.c, e.d + ' 10:00:00']
      );
    }
  });
}

module.exports = { init, query };
