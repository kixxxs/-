// ===== Capacitor sql.js Database Adapter =====
// 移植自 db/db/database.js，在 WebView 中运行 sql.js WASM
// 通过 Capacitor Filesystem 插件持久化数据库文件

var CapDB = (function() {
  var db = null;
  var SQL = null;
  var DESIRED_STORES = [
    '胡桃里中心城','胡桃里时代城','18般罗湖店','18般广州店',
    'Ahouse厦门店','Ahouse无锡店','南宁见山谣','南宁滚滚',
    '昆明滚滚','昆明Bongbong','海口苏荷'
  ];

  function createTables() {
    db.run("CREATE TABLE IF NOT EXISTS stores (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)");
    db.run("CREATE TABLE IF NOT EXISTS artists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, avatar TEXT DEFAULT '', gender TEXT DEFAULT '', store_id INTEGER, store_name TEXT DEFAULT '', positions TEXT DEFAULT '[]', business_level TEXT DEFAULT 'C级', sign_status TEXT DEFAULT '未签约', daily_salary REAL DEFAULT 0, status TEXT DEFAULT '在岗', id_card TEXT DEFAULT '', phone TEXT DEFAULT '', photos TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime')))");
    try { db.run("ALTER TABLE artists ADD COLUMN photos TEXT DEFAULT '[]'"); } catch(_) {}
    try { db.run("ALTER TABLE artists ADD COLUMN videos TEXT DEFAULT '[]'"); } catch(_) {}
    db.run("CREATE TABLE IF NOT EXISTS contracts (id INTEGER PRIMARY KEY AUTOINCREMENT, artist_id INTEGER NOT NULL, artist_name TEXT DEFAULT '', positions TEXT DEFAULT '[]', brand TEXT DEFAULT '', gender TEXT DEFAULT '', id_card TEXT DEFAULT '', phone TEXT DEFAULT '', start_date TEXT DEFAULT '', end_date TEXT DEFAULT '', contract_no TEXT DEFAULT '', sign_status TEXT DEFAULT '未签约', contract_file TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')))");
    try { db.run("ALTER TABLE contracts ADD COLUMN contract_file TEXT DEFAULT ''"); } catch(_) {}
    db.run("CREATE TABLE IF NOT EXISTS evaluations (id INTEGER PRIMARY KEY AUTOINCREMENT, artist_id INTEGER NOT NULL, artist_name TEXT DEFAULT '', store_name TEXT DEFAULT '', overall_score REAL DEFAULT 0, responsibility_score REAL DEFAULT 0, stability_score REAL DEFAULT 0, teamwork_score REAL DEFAULT 0, adaptability_score REAL DEFAULT 0, business_score REAL DEFAULT 0, tags TEXT DEFAULT '[]', comment TEXT DEFAULT '', evaluated_at TEXT DEFAULT (datetime('now','localtime')))");
    try { db.run("ALTER TABLE evaluations ADD COLUMN responsibility_score REAL DEFAULT 0"); } catch(_) {}
    try { db.run("ALTER TABLE evaluations ADD COLUMN stability_score REAL DEFAULT 0"); } catch(_) {}
    try { db.run("ALTER TABLE evaluations ADD COLUMN teamwork_score REAL DEFAULT 0"); } catch(_) {}
    try { db.run("ALTER TABLE evaluations ADD COLUMN adaptability_score REAL DEFAULT 0"); } catch(_) {}
    try { db.run("ALTER TABLE evaluations ADD COLUMN business_score REAL DEFAULT 0"); } catch(_) {}
    db.run("CREATE TABLE IF NOT EXISTS salaries (id INTEGER PRIMARY KEY AUTOINCREMENT, month TEXT DEFAULT '', store_name TEXT DEFAULT '', nature TEXT DEFAULT '', artist_name TEXT DEFAULT '', position TEXT DEFAULT '', daily_salary REAL DEFAULT 0, performance_days INTEGER DEFAULT 0, monthly_salary REAL DEFAULT 0, team_fee REAL DEFAULT 0, travel_fee REAL DEFAULT 0, rent_utility_fee REAL DEFAULT 0, total_amount REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')))");
    try { db.run("ALTER TABLE salaries ADD COLUMN nature TEXT DEFAULT ''"); } catch(_) {}
    try { db.run("ALTER TABLE salaries ADD COLUMN monthly_salary REAL DEFAULT 0"); } catch(_) {}
    try { db.run("ALTER TABLE salaries ADD COLUMN team_fee REAL DEFAULT 0"); } catch(_) {}
    try { db.run("ALTER TABLE salaries ADD COLUMN travel_fee REAL DEFAULT 0"); } catch(_) {}
    try { db.run("ALTER TABLE salaries ADD COLUMN rent_utility_fee REAL DEFAULT 0"); } catch(_) {}
    db.run("CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT '', file_name TEXT DEFAULT '', file_path TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')))");
    db.run("CREATE TABLE IF NOT EXISTS reserve_artists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, avatar TEXT DEFAULT '', gender TEXT DEFAULT '', age INTEGER DEFAULT 0, height TEXT DEFAULT '', region TEXT DEFAULT '', positions TEXT DEFAULT '[]', business_level TEXT DEFAULT 'C级', daily_salary REAL DEFAULT 0, phone TEXT DEFAULT '', status TEXT DEFAULT '待定', evaluator TEXT DEFAULT '', evaluation_content TEXT DEFAULT '', experience TEXT DEFAULT '', photos TEXT DEFAULT '[]', videos TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime')))");
    try { db.run("ALTER TABLE reserve_artists ADD COLUMN linked_artist_id INTEGER DEFAULT NULL"); } catch(_) {}
    try { db.run("ALTER TABLE artists ADD COLUMN linked_reserve_id INTEGER DEFAULT NULL"); } catch(_) {}
  }

  function execSelect(sql, params) {
    if (params && params.length > 0) {
      var stmt = db.prepare(sql);
      stmt.bind(params);
      var results = [];
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
      return results;
    }
    var result = db.exec(sql);
    if (!result || result.length === 0 || !result[0] || !result[0].values) return [];
    var columns = result[0].columns;
    var values = result[0].values;
    return (values || []).map(function(row) {
      var obj = {};
      columns.forEach(function(col, i) { obj[col] = row[i]; });
      return obj;
    });
  }

  function saveDb() {
    if (!db) return;
    try {
      var data = db.export();
      var arr = new Uint8Array(data);
      var binaryStr = '';
      for (var i = 0; i < arr.length; i++) {
        binaryStr += String.fromCharCode(arr[i]);
      }
      var base64 = btoa(binaryStr);
      // Use Capacitor Filesystem (direct native bridge call)
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
        window.Capacitor.Plugins.Filesystem.writeFile({
          path: 'artist_data.db',
          data: base64,
          directory: 'DATA',
          recursive: true
        }).catch(function(e) {
          console.error('[CapDB] Failed to save database:', e);
        });
      }
    } catch(e) {
      console.error('[CapDB] saveDb error:', e);
    }
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
    var lastId = db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0];
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

  function syncStores() {
    var existing = execSelect('SELECT name FROM stores').map(function(r) { return r.name; });
    var toRemove = existing.filter(function(n) { return DESIRED_STORES.indexOf(n) === -1; });
    var toAdd = DESIRED_STORES.filter(function(n) { return existing.indexOf(n) === -1; });
    toRemove.forEach(function(name) { execRun("DELETE FROM stores WHERE name = ?", [name]); });
    toAdd.forEach(function(name) { execRun("INSERT INTO stores (name) VALUES (?)", [name]); });
  }

  function seedData() {
    var storeIds = {};
    DESIRED_STORES.forEach(function(s) {
      var r = query("INSERT INTO stores (name) VALUES (?)", [s]);
      storeIds[s] = r.lastInsertRowid;
    });

    var today = new Date();
    var fmt = function(d) { return d.toISOString().slice(0,10); };
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
      else if (i < 7) endDate = daysBefore(-Math.floor(Math.random()*80)-10);
      else endDate = daysBefore(-Math.floor(Math.random()*300)-120);
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

  function mapArtist(row) {
    return {
      id: row.id,
      name: row.name,
      avatar: row.avatar || '',
      status: row.status || '在岗',
      level: row.business_level || 'C级',
      store: row.store_name || '',
      position: (function() {
        try { return JSON.parse(row.positions || '[]').join(', '); } catch(_) { return row.positions || ''; }
      })(),
      contractStatus: row.sign_status || '未签约',
      dailySalary: row.daily_salary || 0,
      linkedReserveId: row.linked_reserve_id || null,
      gender: row.gender || '',
      idNumber: row.id_card || '',
      phone: row.phone || '',
      photos: row.photos || '[]',
      videos: row.videos || '[]'
    };
  }

  function mapContract(row) {
    return {
      id: row.id,
      artistId: row.artist_id || 0,
      artistName: row.artist_name || '',
      position: (function() {
        try { return JSON.parse(row.positions || '[]').join(', '); } catch(_) { return row.positions || ''; }
      })(),
      brand: row.brand || '',
      gender: row.gender || '',
      idNumber: row.id_card || '',
      phone: row.phone || '',
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      contractNumber: row.contract_no || '',
      status: row.sign_status || '未签约',
      contractFile: row.contract_file || ''
    };
  }

  function mapEvaluation(row) {
    return {
      id: row.id,
      artistId: row.artist_id || 0,
      artistName: row.artist_name || '',
      storeName: row.store_name || '',
      overallScore: row.overall_score || 0,
      responsibilityScore: row.responsibility_score || 0,
      stabilityScore: row.stability_score || 0,
      teamworkScore: row.teamwork_score || 0,
      adaptabilityScore: row.adaptability_score || 0,
      businessScore: row.business_score || 0,
      tags: (function() { try { return JSON.parse(row.tags || '[]'); } catch(_) { return []; } })(),
      comment: row.comment || '',
      evaluatedAt: (row.evaluated_at || '').slice(0, 10)
    };
  }

  function mapSalary(row) {
    return {
      id: row.id,
      month: row.month || '',
      store: row.store_name || '',
      nature: row.nature || '',
      name: row.artist_name || '',
      position: row.position || '',
      dailySalary: row.daily_salary || 0,
      performanceDays: row.performance_days || 0,
      monthlySalary: row.monthly_salary || 0,
      teamFee: row.team_fee || 0,
      travelFee: row.travel_fee || 0,
      rentUtilityFee: row.rent_utility_fee || 0,
      totalAmount: row.total_amount || 0
    };
  }

  async function init() {
    // Load sql.js WASM
    if (typeof initSqlJs === 'undefined') {
      console.error('[CapDB] sql.js not loaded (initSqlJs is not defined)');
      return false;
    }
    try {
      SQL = await initSqlJs({
        locateFile: function(file) {
          return 'assets/' + file;
        }
      });
    } catch(e) {
      console.error('[CapDB] Failed to initialize sql.js:', e);
      return false;
    }

    // Try to restore database from device filesystem
    var restored = false;
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
      try {
        var result = await window.Capacitor.Plugins.Filesystem.readFile({
          path: 'artist_data.db',
          directory: 'DATA'
        });
        if (result && result.data) {
          var binaryStr = atob(result.data);
          var bytes = new Uint8Array(binaryStr.length);
          for (var i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          db = new SQL.Database(bytes);
          restored = true;
          console.log('[CapDB] Database restored from device storage');
        }
      } catch(e) {
        console.log('[CapDB] No existing database file, creating new');
      }
    }

    if (!restored) {
      db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');
    createTables();
    syncStores();

    var rows = execSelect("SELECT COUNT(*) AS c FROM artists");
    if (rows.length === 0 || rows[0].c === 0) {
      seedData();
    }

    saveDb();
    console.log('[CapDB] Database initialized successfully');
    return true;
  }

  function getAllData() {
    var artists = execSelect("SELECT * FROM artists WHERE COALESCE(status,'') != '-1'").map(mapArtist);
    var contracts = execSelect("SELECT * FROM contracts").map(mapContract);
    var evaluations = execSelect("SELECT * FROM evaluations ORDER BY evaluated_at DESC").map(mapEvaluation);
    var stores = execSelect("SELECT name FROM stores").map(function(r) { return r.name; });
    var salaries = execSelect("SELECT * FROM salaries ORDER BY created_at DESC").map(mapSalary);
    var announcements = execSelect("SELECT * FROM announcements ORDER BY created_at DESC").map(mapAnnouncement);
    var reserveArtists = execSelect("SELECT * FROM reserve_artists WHERE COALESCE(status,'') != '-1'").map(mapReserveArtist);
    return { artists: artists, contracts: contracts, evaluations: evaluations, stores: stores, salaries: salaries, announcements: announcements, reserveArtists: reserveArtists };
  }

  function addArtist(artistData) {
    var posJson = JSON.stringify(
      (artistData.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; })
    );
    var result = query(
      "INSERT INTO artists (name, avatar, status, business_level, store_name, positions, sign_status, daily_salary) VALUES (?,?,?,?,?,?,?,?)",
      [artistData.name, artistData.avatar || '', artistData.status || '在岗', artistData.level || 'B级',
       artistData.store || '', posJson, artistData.contractStatus || '未签约', artistData.dailySalary || 0]
    );
    return { ok: true, data: { id: result.lastInsertRowid } };
  }

  function updateArtist(artistData) {
    var posJson = JSON.stringify(
      (artistData.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; })
    );
    // Preserve existing phone/gender/id_card when not provided (avoid wiping synced data)
    var existing = query('SELECT phone, gender, id_card FROM artists WHERE id = ?', [artistData.id]);
    var existingRow = (existing && existing.length > 0) ? existing[0] : null;
    var phone = artistData.phone || (existingRow ? existingRow.phone || '' : '');
    var gender = artistData.gender || (existingRow ? existingRow.gender || '' : '');
    var idCard = artistData.idNumber || (existingRow ? existingRow.id_card || '' : '');
    query(
      "UPDATE artists SET name=?, avatar=?, status=?, business_level=?, store_name=?, positions=?, sign_status=?, daily_salary=?, phone=?, gender=?, id_card=?, updated_at=datetime('now','localtime') WHERE id=?",
      [artistData.name, artistData.avatar || '', artistData.status || '在岗', artistData.level || 'B级',
       artistData.store || '', posJson, artistData.contractStatus || '未签约', artistData.dailySalary || 0, phone, gender, idCard, artistData.id]
    );
    // 状态改为"待岗" → 自动同步到艺人储备库
    if (artistData.status === '待岗') {
      var rows = query('SELECT * FROM artists WHERE id = ?', [artistData.id]);
      if (rows && rows.length > 0) {
        var row = rows[0];
        var linkedId = row.linked_reserve_id || null;
        var prevExperience = '';
        if (linkedId) {
          var prev = query('SELECT experience FROM reserve_artists WHERE id = ?', [linkedId]);
          if (prev && prev.length > 0) prevExperience = prev[0].experience || '';
        }
        if (linkedId) {
          query(
            "UPDATE reserve_artists SET name=?, avatar=?, gender=?, business_level=?, positions=?, daily_salary=?, phone=?, photos=?, videos=?, experience=?, status='待定', updated_at=datetime('now','localtime') WHERE id=?",
            [row.name, row.avatar || '', row.gender || '', row.business_level || 'B级', row.positions || '[]', row.daily_salary || 0, row.phone || '', row.photos || '[]', row.videos || '[]', prevExperience, linkedId]
          );
        } else {
          var result = query(
            "INSERT INTO reserve_artists (name, avatar, gender, age, height, region, positions, business_level, daily_salary, phone, photos, videos, status, experience, linked_artist_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [row.name, row.avatar || '', row.gender || '', 0, '', '', row.positions || '[]', row.business_level || 'B级', row.daily_salary || 0, row.phone || '', row.photos || '[]', row.videos || '[]', '待定', prevExperience, row.id]
          );
          query('UPDATE artists SET linked_reserve_id = ? WHERE id = ?', [result.lastInsertRowid, row.id]);
        }
        query("UPDATE artists SET status = '-1' WHERE id = ?", [artistData.id]);
      }
    }
    return { ok: true };
  }

  function deleteArtist(id) {
    query("UPDATE artists SET status = '-1' WHERE id = ?", [id]);
    return { ok: true };
  }

  function addContract(contractData) {
    var posJson = JSON.stringify(
      (contractData.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; })
    );
    var result = query(
      "INSERT INTO contracts (artist_id, artist_name, positions, brand, gender, id_card, phone, start_date, end_date, contract_no, sign_status, contract_file) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [0, contractData.name || '', posJson, contractData.brand || '', contractData.gender || '',
       contractData.idNumber || '', contractData.phone || '', contractData.startDate || '',
       contractData.endDate || '', contractData.contractNo || '', contractData.signStatus || '未签约',
       contractData.contractFile || '']
    );
    return { ok: true, data: { id: result.lastInsertRowid } };
  }

  function updateContract(contractData) {
    var posJson = JSON.stringify(
      (contractData.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; })
    );
    query(
      "UPDATE contracts SET artist_name=?, positions=?, brand=?, gender=?, id_card=?, phone=?, start_date=?, end_date=?, contract_no=?, sign_status=?, contract_file=? WHERE id=?",
      [contractData.name, posJson, contractData.brand || '', contractData.gender || '',
       contractData.idNumber || '', contractData.phone || '', contractData.startDate || '',
       contractData.endDate || '', contractData.contractNo || '', contractData.signStatus || '未签约',
       contractData.contractFile || '', contractData.id]
    );
    return { ok: true };
  }

  function addSalaries(salaryList) {
    var count = 0;
    salaryList.forEach(function(sd) {
      query(
        "INSERT INTO salaries (month, store_name, nature, artist_name, position, daily_salary, performance_days, monthly_salary, team_fee, travel_fee, rent_utility_fee, total_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [sd.month || '', sd.store || '', sd.nature || '', sd.name || '', sd.position || '',
         sd.dailySalary || 0, sd.performanceDays || 0, sd.monthlySalary || 0, sd.teamFee || 0,
         sd.travelFee || 0, sd.rentUtilityFee || 0, sd.totalAmount || 0]
      );
      count++;
    });
    return { ok: true, data: { count: count } };
  }

  function addEvaluations(evalList) {
    var count = 0;
    evalList.forEach(function(ed) {
      query(
        "INSERT INTO evaluations (artist_id, artist_name, store_name, overall_score, responsibility_score, stability_score, teamwork_score, adaptability_score, business_score, tags, comment, evaluated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [0, ed.name || '', ed.store || '', ed.overallScore || 0, ed.responsibilityScore || 0,
         ed.stabilityScore || 0, ed.teamworkScore || 0, ed.adaptabilityScore || 0, ed.businessScore || 0,
         JSON.stringify(ed.tags || []), ed.comment || '', (ed.evaluatedAt || '') + ' 10:00:00']
      );
      count++;
    });
    return { ok: true, data: { count: count } };
  }

  function saveArtistPhotos(artistId, photosJson) {
    query("UPDATE artists SET photos=?, updated_at=datetime('now','localtime') WHERE id=?", [photosJson, artistId]);
    return { ok: true };
  }

  function saveArtistVideos(artistId, videosJson) {
    query("UPDATE artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?", [videosJson, artistId]);
    return { ok: true };
  }

  function saveArtistVideo(artistId, dataUrl, fileName) {
    var matches = dataUrl.match(/^data:video\/(\w+);base64,(.+)$/);
    if (!matches) throw new Error('无效的视频格式');
    var ext = matches[1];
    if (ext === 'quicktime') ext = 'mov';
    var videoId = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    var rows = query('SELECT videos FROM artists WHERE id = ?', [artistId]);
    if (!rows || rows.length === 0) throw new Error('艺人不存在');
    var videos = [];
    try { videos = JSON.parse(rows[0].videos || '[]'); } catch(_) {}
    // Capacitor mobile: store base64 dataUrl inline (no file system)
    var base64Data = matches[2];
    videos.push({
      id: videoId,
      fileName: fileName,
      serverPath: '',
      localPath: dataUrl,
      size: Math.round(base64Data.length * 3 / 4),
      mimeType: 'video/' + ext,
      uploadedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
    query("UPDATE artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?", [JSON.stringify(videos), artistId]);
    return { ok: true, path: dataUrl };
  }

  function deleteArtistVideo(artistId, videoId) {
    var rows = query('SELECT videos FROM artists WHERE id = ?', [artistId]);
    if (!rows || rows.length === 0) return { ok: true };
    var videos = [];
    try { videos = JSON.parse(rows[0].videos || '[]'); } catch(_) {}
    var remaining = videos.filter(function(v) { return v.id !== videoId; });
    query("UPDATE artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?", [JSON.stringify(remaining), artistId]);
    return { ok: true };
  }

  function saveAvatar(dataUrl, artistName) {
    // 直接返回 dataUrl，存入数据库 avatar 字段，无需写文件
    return dataUrl;
  }

  function addAnnouncement(data) {
    var result = query(
      "INSERT INTO announcements (title, file_name, file_path) VALUES (?,?,?)",
      [data.title || '', data.fileName || '', data.fileData || data.filePath || '']
    );
    return { ok: true, data: { id: result.lastInsertRowid } };
  }

  function deleteAnnouncement(id) {
    query("DELETE FROM announcements WHERE id = ?", [id]);
    return { ok: true };
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
      avatar: a.avatar || '',
      gender: a.gender || '',
      age: a.age || 0,
      height: a.height || '',
      region: a.region || '',
      position: (function() {
        try { return JSON.parse(a.positions || '[]').join(', '); } catch(_) { return a.positions || ''; }
      })(),
      level: a.business_level || 'C级',
      dailySalary: a.daily_salary || 0,
      phone: a.phone || '',
      status: a.status || '待定',
      evaluator: a.evaluator || '',
      evaluationContent: a.evaluation_content || '',
      experience: a.experience || '',
      photos: a.photos || '[]',
      videos: a.videos || '[]',
      createdAt: a.created_at ? a.created_at.slice(0, 19) : '',
      updatedAt: a.updated_at ? a.updated_at.slice(0, 19) : ''
    };
  }

  function addReserveArtist(data) {
    var posJson = JSON.stringify(
      (data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; })
    );
    var result = query(
      "INSERT INTO reserve_artists (name, avatar, gender, age, height, region, positions, business_level, daily_salary, phone, status, evaluator, evaluation_content, experience) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [data.name, data.avatar || '', data.gender || '', data.age || 0, data.height || '', data.region || '',
       posJson, data.level || 'C级', data.dailySalary || 0, data.phone || '', data.status || '待定',
       data.evaluator || '', data.evaluationContent || '', data.experience || '']
    );
    return { ok: true, data: { id: result.lastInsertRowid } };
  }

  function updateReserveArtist(data) {
    var posJson = JSON.stringify(
      (data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; })
    );
    query(
      "UPDATE reserve_artists SET name=?, avatar=?, gender=?, age=?, height=?, region=?, positions=?, business_level=?, daily_salary=?, phone=?, status=?, evaluator=?, evaluation_content=?, experience=?, updated_at=datetime('now','localtime') WHERE id=?",
      [data.name, data.avatar || '', data.gender || '', data.age || 0, data.height || '', data.region || '',
       posJson, data.level || 'C级', data.dailySalary || 0, data.phone || '', data.status || '待定',
       data.evaluator || '', data.evaluationContent || '', data.experience || '', data.id]
    );
    // 状态改为"已安排" → 自动同步到艺人信息库
    if (data.status === '已安排') {
      var rows = query('SELECT * FROM reserve_artists WHERE id = ?', [data.id]);
      if (rows && rows.length > 0) {
        var r = rows[0];
        var linkedId = r.linked_artist_id || null;
        if (linkedId) {
          query(
            "UPDATE artists SET name=?, avatar=?, gender=?, business_level=?, positions=?, daily_salary=?, phone=?, photos=?, videos=?, status='在岗', updated_at=datetime('now','localtime') WHERE id=?",
            [r.name, r.avatar || '', r.gender || '', r.business_level || 'B+级', r.positions || '[]', r.daily_salary || 0, r.phone || '', r.photos || '[]', r.videos || '[]', linkedId]
          );
        } else {
          var result = query(
            "INSERT INTO artists (name, avatar, gender, store_name, positions, business_level, sign_status, daily_salary, phone, photos, videos, status, linked_reserve_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [r.name, r.avatar || '', r.gender || '', '', r.positions || '[]', r.business_level || 'B+级', '未签约', r.daily_salary || 0, r.phone || '', r.photos || '[]', r.videos || '[]', '在岗', r.id]
          );
          query('UPDATE reserve_artists SET linked_artist_id = ? WHERE id = ?', [result.lastInsertRowid, r.id]);
        }
        query("UPDATE reserve_artists SET status = '-1' WHERE id = ?", [data.id]);
      }
    }
    return { ok: true };
  }

  function deleteReserveArtist(id) {
    query("UPDATE reserve_artists SET status = '-1' WHERE id = ?", [id]);
    return { ok: true };
  }

  function saveReserveArtistPhotos(id, photosJson) {
    query("UPDATE reserve_artists SET photos=?, updated_at=datetime('now','localtime') WHERE id=?", [photosJson, id]);
    return { ok: true };
  }

  function saveReserveArtistVideos(id, videosJson) {
    query("UPDATE reserve_artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?", [videosJson, id]);
    return { ok: true };
  }

  function saveReserveArtistExperience(id, experience) {
    query("UPDATE reserve_artists SET experience=?, updated_at=datetime('now','localtime') WHERE id=?", [experience || '', id]);
    return { ok: true };
  }

  function saveReserveVideo(id, dataUrl, fileName) {
    var matches = dataUrl.match(/^data:video\/(\w+);base64,(.+)$/);
    if (!matches) throw new Error('无效的视频格式');
    var ext = matches[1];
    if (ext === 'quicktime') ext = 'mov';
    var videoId = 'rv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    var rows = query('SELECT videos FROM reserve_artists WHERE id = ?', [id]);
    if (!rows || rows.length === 0) throw new Error('储备艺人不存在');
    var videos = [];
    try { videos = JSON.parse(rows[0].videos || '[]'); } catch(_) {}
    var base64Data = matches[2];
    videos.push({
      id: videoId,
      fileName: fileName,
      serverPath: '',
      localPath: dataUrl,
      size: Math.round(base64Data.length * 3 / 4),
      mimeType: 'video/' + ext,
      uploadedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
    query("UPDATE reserve_artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?", [JSON.stringify(videos), id]);
    return { ok: true, path: dataUrl };
  }

  function deleteReserveVideo(id, videoId) {
    var rows = query('SELECT videos FROM reserve_artists WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return { ok: true };
    var videos = [];
    try { videos = JSON.parse(rows[0].videos || '[]'); } catch(_) {}
    var remaining = videos.filter(function(v) { return v.id !== videoId; });
    query("UPDATE reserve_artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?", [JSON.stringify(remaining), id]);
    return { ok: true };
  }

  function batchAddReserveArtists(list) {
    var count = 0;
    list.forEach(function(item) {
      var posJson = JSON.stringify(
        (item.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; })
      );
      query(
        "INSERT INTO reserve_artists (name, avatar, gender, age, height, region, positions, business_level, daily_salary, phone, status, evaluator, evaluation_content) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [item.name || '', '', item.gender || '', parseInt(item.age) || 0, item.height || '', item.region || '',
         posJson, item.level || 'C级', parseFloat(item.dailySalary) || 0, item.phone || '',
         item.status || '待定', item.evaluator || '', item.evaluationContent || '']
      );
      count++;
    });
    return { ok: true, data: { count: count } };
  }

  function resetAllData() {
    query("DELETE FROM salaries");
    query("DELETE FROM evaluations");
    query("DELETE FROM contracts");
    query("DELETE FROM announcements");
    query("UPDATE artists SET status = '-1'");
    query("UPDATE reserve_artists SET status = '-1'");
    return { ok: true };
  }

  return {
    init: init,
    query: query,
    getAllData: getAllData,
    addArtist: addArtist,
    updateArtist: updateArtist,
    deleteArtist: deleteArtist,
    addContract: addContract,
    updateContract: updateContract,
    addSalaries: addSalaries,
    addEvaluations: addEvaluations,
    saveArtistPhotos: saveArtistPhotos,
    saveArtistVideos: saveArtistVideos,
    saveArtistVideo: saveArtistVideo,
    deleteArtistVideo: deleteArtistVideo,
    saveAvatar: saveAvatar,
    resetAllData: resetAllData,
    addAnnouncement: addAnnouncement,
    deleteAnnouncement: deleteAnnouncement,
    addReserveArtist: addReserveArtist,
    updateReserveArtist: updateReserveArtist,
    deleteReserveArtist: deleteReserveArtist,
    saveReserveArtistPhotos: saveReserveArtistPhotos,
    saveReserveArtistVideos: saveReserveArtistVideos,
    saveReserveArtistExperience: saveReserveArtistExperience,
    saveReserveVideo: saveReserveVideo,
    deleteReserveVideo: deleteReserveVideo,
    batchAddReserveArtists: batchAddReserveArtists
  };
})();
