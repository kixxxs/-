const { app, BrowserWindow, ipcMain, dialog, Menu, protocol, net } = require('electron');
// autoUpdater lazy-loaded in setupAutoUpdater() to avoid early init before app is ready
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('./db/db/database.js');

let mainWindow;

// Get writable assets directory (userData when packaged, __dirname/src in dev)
function getAssetsDir() {
  if (app.isPackaged) {
    var dir = path.join(app.getPath('userData'), 'assets');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  return path.join(__dirname, 'src', 'assets');
}

// Resolve asset path for reading: check userData first, then asar.
// Normalizes and validates path stays within allowed directories to prevent traversal.
function resolveAssetPath(subPath) {
  // Reject empty, null, or absolute paths
  if (!subPath || typeof subPath !== 'string') return null;
  if (path.isAbsolute(subPath)) return null;

  // Normalize to remove .. and . segments
  var normalized = path.normalize(subPath);
  // Reject if path tries to escape via .. after normalization
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) return null;

  if (app.isPackaged) {
    var assetsRoot = getAssetsDir();
    var userPath = path.join(assetsRoot, normalized);
    // Double-check resolved path stays within assets directory
    if (!userPath.startsWith(assetsRoot + path.sep) && userPath !== assetsRoot) return null;
    if (fs.existsSync(userPath)) return userPath;
    var asarRoot = path.join(__dirname, 'src');
    var asarPath = path.join(asarRoot, normalized);
    if (!asarPath.startsWith(asarRoot + path.sep) && asarPath !== asarRoot) return null;
    return asarPath;
  }
  var devRoot = path.join(__dirname, 'src');
  var devPath = path.join(devRoot, normalized);
  if (!devPath.startsWith(devRoot + path.sep) && devPath !== devRoot) return null;
  return devPath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: '艺人管理系统',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: app.isPackaged
    }
  });
  mainWindow.loadFile('src/index.html');
  mainWindow.setMenuBarVisibility(false);
  mainWindow.maximize();
}

// Register custom protocol as privileged (must be before app.ready)
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
]);

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  // Register custom protocol for serving local assets (videos, etc.) with Range support
  protocol.handle('app-file', function(request) {
    try {
      var relativePath = request.url.replace('app-file://', '');
      var filePath = resolveAssetPath(relativePath);
      if (!filePath || !fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } });
      }
      var stat = fs.statSync(filePath);
      var fileSize = stat.size;
      var ext = path.extname(filePath).toLowerCase();
      var mimeMap = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska' };
      var mimeType = mimeMap[ext] || 'video/mp4';

      var rangeHeader = request.headers.get('range');
      if (rangeHeader) {
        var parts = rangeHeader.replace(/bytes=/, '').split('-');
        var start = parseInt(parts[0], 10) || 0;
        var end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 10 * 1024 * 1024 - 1, fileSize - 1);
        var chunkSize = end - start + 1;
        var buf = Buffer.alloc(chunkSize);
        var fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buf, 0, chunkSize, start);
        fs.closeSync(fd);
        return new Response(buf, {
          status: 206,
          headers: {
            'Content-Range': 'bytes ' + start + '-' + end + '/' + fileSize,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': mimeType
          }
        });
      }
      // No Range header: read full file (small files only; video tags send Range headers)
      var fullBuf = fs.readFileSync(filePath);
      return new Response(fullBuf, {
        status: 200,
        headers: { 'Content-Length': String(fileSize), 'Content-Type': mimeType, 'Accept-Ranges': 'bytes' }
      });
    } catch(err) {
      return new Response('Internal Error', { status: 500, headers: { 'content-type': 'text/plain' } });
    }
  });

  createWindow();
  setupAutoUpdater();
  await Database.init();
});

// ===== Auto Updater =====

function setupAutoUpdater() {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.logger = {
    info: function(msg) { console.log('[Updater] ' + msg); },
    warn: function(msg) { console.warn('[Updater] ' + msg); },
    error: function(msg) { console.error('[Updater] ' + msg); }
  };
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', function() {
    sendUpdateStatus('checking');
  });

  autoUpdater.on('update-available', function(info) {
    sendUpdateStatus('available', info);
  });

  autoUpdater.on('update-not-available', function(info) {
    sendUpdateStatus('not-available', info);
  });

  autoUpdater.on('download-progress', function(progress) {
    sendUpdateStatus('progress', { percent: progress.percent });
  });

  autoUpdater.on('update-downloaded', function(info) {
    sendUpdateStatus('downloaded', info);
  });

  autoUpdater.on('error', function(err) {
    sendUpdateStatus('error', { message: err.message });
  });

  setTimeout(function() {
    autoUpdater.checkForUpdates().catch(function(err) {
      console.error('[Updater] Check failed:', err.message);
    });
  }, 5000);
}

function sendUpdateStatus(status, info) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status: status, info: info || {} });
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// db-query handler removed for security — no raw SQL from renderer

ipcMain.handle('db-export-all', () => {
  try {
    const artists = Database.query('SELECT * FROM artists WHERE status != -1');
    const contracts = Database.query('SELECT * FROM contracts');
    const evaluations = Database.query('SELECT * FROM evaluations');
    const stores = Database.query('SELECT * FROM stores');
    const salaries = Database.query('SELECT * FROM salaries ORDER BY created_at DESC');
    return { ok: true, data: { artists, contracts, evaluations, stores, salaries } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('save-contract-file', async (event, dataUrl, contractId) => {
  try {
    const matches = dataUrl.match(/^data:application\/pdf;base64,(.+)$/);
    if (!matches) return { ok: false, error: '无效的PDF格式' };
    const buffer = Buffer.from(matches[1], 'base64');
    const pdfDir = path.join(getAssetsDir(), 'contracts');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const fileName = `contract_${contractId}_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(pdfDir, fileName), buffer);
    return { ok: true, path: `assets/contracts/${fileName}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('read-contract-file', async (event, filePath) => {
  try {
    const fullPath = resolveAssetPath(filePath);
    if (!fullPath || !fs.existsSync(fullPath)) return { ok: false, error: '文件不存在' };
    const buffer = fs.readFileSync(fullPath);
    const base64 = buffer.toString('base64');
    return { ok: true, data: 'data:application/pdf;base64,' + base64 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('save-avatar', async (event, dataUrl, artistName) => {
  try {
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return { ok: false, error: '无效的图片格式' };
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const avatarDir = path.join(getAssetsDir(), 'avatars');
    if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
    // Sanitize artistName to prevent path traversal (same logic as server/database.js)
    var safeName = String(artistName || 'unknown').replace(/[\/\\\.]{2,}/g, '_').replace(/[\/\\]/g, '_').slice(0, 100);
    const fileName = `${safeName}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(avatarDir, fileName), buffer);
    return { ok: true, path: `assets/avatars/${fileName}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('select-export-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// read-file handler removed for security — no arbitrary file reads from renderer

ipcMain.handle('select-and-read-csv', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
  });
  if (result.canceled) return { ok: false, canceled: true };
  try {
    const filePath = result.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    const bytes = new Uint8Array(buffer);

    var content;
    // 检查 UTF-8 BOM: EF BB BF
    var hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;

    if (hasUtf8Bom) {
      content = new TextDecoder('utf-8').decode(bytes);
    } else {
      // 先尝试 UTF-8
      content = new TextDecoder('utf-8').decode(bytes);
      // 验证关键字：如果找不到"姓名"，尝试 GBK
      if (content.indexOf('姓名') === -1) {
        try {
          var gbkContent = new TextDecoder('gbk').decode(bytes);
          if (gbkContent.indexOf('姓名') !== -1) {
            content = gbkContent;
          }
        } catch (_) {}
      }
    }

    const fileName = path.basename(filePath);
    return { ok: true, data: content, fileName: fileName };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ===== 前端数据接口层 (转换数据库格式 <-> 前端格式) =====

ipcMain.handle('get-init-data', () => {
  try {
    const artists = Database.query("SELECT id,name,avatar,status,business_level,store_name,positions,sign_status,daily_salary,linked_reserve_id,gender,id_card,age,phone FROM artists WHERE COALESCE(status,'') != '-1'");
    const contracts = Database.query('SELECT * FROM contracts');
    const evaluations = Database.query('SELECT * FROM evaluations ORDER BY evaluated_at DESC');
    const stores = Database.query('SELECT * FROM stores');
    const salaries = Database.query('SELECT * FROM salaries ORDER BY created_at DESC');
    const announcements = Database.query('SELECT * FROM announcements ORDER BY created_at DESC');

    return {
      ok: true,
      data: {
        artists: (artists || []).map(function(a) {
          return {
            id: a.id,
            name: a.name,
            avatar: a.avatar || 'https://picsum.photos/id/' + (a.id + 10) + '/40/40',
            photos: '[]',
            videos: '[]',
            status: a.status || '在岗',
            level: a.business_level || 'B级',
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
        }),
        contracts: (contracts || []).map(function(c) {
          return {
            id: c.id,
            artistId: c.artist_id,
            artistName: c.artist_name || '',
            position: c.positions ? JSON.parse(c.positions).join(', ') : '',
            brand: c.brand || '',
            gender: c.gender || '',
            idNumber: c.id_card || '',
            phone: c.phone || '',
            startDate: c.start_date || '',
            endDate: c.end_date || '',
            contractNumber: c.contract_no || '',
            status: c.sign_status || '未签约',
            contractFile: c.contract_file || ''
          };
        }),
        evaluations: (evaluations || []).map(function(e) {
          return {
            id: e.id,
            artistId: e.artist_id,
            artistName: e.artist_name || '',
            storeName: e.store_name || '',
            overallScore: e.overall_score || 0,
            responsibilityScore: e.responsibility_score || 0,
            stabilityScore: e.stability_score || 0,
            teamworkScore: e.teamwork_score || 0,
            adaptabilityScore: e.adaptability_score || 0,
            businessScore: e.business_score || 0,
            tags: e.tags ? JSON.parse(e.tags) : [],
            comment: e.comment || '',
            evaluatedAt: e.evaluated_at ? e.evaluated_at.slice(0, 10) : ''
          };
        }),
        stores: (stores || []).map(function(s) { return s.name; }),
        salaries: (salaries || []).map(function(s) {
          return {
            id: s.id,
            month: s.month || '',
            store: s.store_name || '',
            nature: s.nature || '',
            name: s.artist_name || '',
            position: s.position || '',
            dailySalary: s.daily_salary || 0,
            performanceDays: s.performance_days || 0,
            monthlySalary: s.monthly_salary || 0,
            teamFee: s.team_fee || 0,
            travelFee: s.travel_fee || 0,
            rentUtilityFee: s.rent_utility_fee || 0,
            totalAmount: s.total_amount || 0
          };
        }),
        announcements: (announcements || []).map(function(a) {
          return {
            id: a.id,
            title: a.title || '',
            fileName: a.file_name || '',
            filePath: a.file_path || '',
            createdAt: a.created_at ? a.created_at.slice(0, 19) : ''
          };
        })
      }
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('add-artist', (event, data) => {
  try {
    var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
    var result = Database.query(
      "INSERT INTO artists (name, avatar, status, business_level, store_name, positions, sign_status, daily_salary) VALUES (?,?,?,?,?,?,?,?)",
      [data.name, data.avatar || '', data.status || '在岗', data.level || 'B级',
       data.store || '', posJson, data.contractStatus || '未签约', data.dailySalary || 0]
    );
    return { ok: true, data: { id: result.lastInsertRowid } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('delete-artist', (event, id) => {
  try {
    Database.query("UPDATE artists SET status = '-1' WHERE id = ?", [id]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('update-artist', (event, data) => {
  try {
    var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
    // Preserve existing phone/gender/id_card/age when not explicitly provided
    var existing = Database.query("SELECT phone, gender, id_card, age FROM artists WHERE id = ?", [data.id]);
    var existingRow = (existing && existing.length > 0) ? existing[0] : null;
    var phone = data.phone !== undefined && data.phone !== null ? data.phone : (existingRow ? existingRow.phone || '' : '');
    var gender = data.gender !== undefined && data.gender !== null ? data.gender : (existingRow ? existingRow.gender || '' : '');
    var idCard = data.idNumber !== undefined && data.idNumber !== null ? data.idNumber : (existingRow ? existingRow.id_card || '' : '');
    var age = data.age !== undefined && data.age !== null ? data.age : (existingRow ? existingRow.age || 0 : 0);
    Database.query(
      "UPDATE artists SET name=?, avatar=?, status=?, business_level=?, store_name=?, positions=?, sign_status=?, daily_salary=?, phone=?, gender=?, id_card=?, age=?, updated_at=datetime('now','localtime') WHERE id=?",
      [data.name, data.avatar || '', data.status || '在岗', data.level || 'B级', data.store || '',
       posJson, data.contractStatus || '未签约', data.dailySalary || 0, phone, gender, idCard, age, data.id]
    );
    // 状态改为"待岗" → 自动移到艺人储备库
    if (data.status === '待岗') {
      var rows = Database.query("SELECT * FROM artists WHERE id = ?", [data.id]);
      if (rows && rows.length > 0) {
        var row = rows[0];
        var linkedId = row.linked_reserve_id || null;
        // Preserve experience from linked reserve record
        var prevExperience = '';
        if (linkedId) {
          var prev = Database.query("SELECT experience FROM reserve_artists WHERE id = ?", [linkedId]);
          if (prev && prev.length > 0) prevExperience = prev[0].experience || '';
        }
        if (linkedId) {
          Database.query(
            "UPDATE reserve_artists SET name=?, avatar=?, gender=?, age=?, business_level=?, positions=?, daily_salary=?, phone=?, photos=?, videos=?, experience=?, status='待定', updated_at=datetime('now','localtime') WHERE id=?",
            [row.name, row.avatar || '', row.gender || '', row.age || 0, row.business_level || 'B级', row.positions || '[]', row.daily_salary || 0, row.phone || '', row.photos || '[]', row.videos || '[]', prevExperience, linkedId]
          );
        } else {
          var result = Database.query(
            "INSERT INTO reserve_artists (name, avatar, gender, age, height, region, positions, business_level, daily_salary, phone, photos, videos, status, experience, linked_artist_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [row.name, row.avatar || '', row.gender || '', row.age || 0, '', '', row.positions || '[]', row.business_level || 'B级', row.daily_salary || 0, row.phone || '', row.photos || '[]', row.videos || '[]', '待定', prevExperience, row.id]
          );
          linkedId = result.lastInsertRowid;
          Database.query("UPDATE artists SET linked_reserve_id = ? WHERE id = ?", [linkedId, row.id]);
        }
        Database.query("UPDATE artists SET status = '-1' WHERE id = ?", [data.id]);
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('add-contract', (event, data) => {
  try {
    var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
    var contractFile = data.contractFile || '';
    // If contractFile is a base64 data URL, save to disk and store path
    if (contractFile && contractFile.startsWith('data:application/pdf;base64,')) {
      var matches = contractFile.match(/^data:application\/pdf;base64,(.+)$/);
      if (matches) {
        var buffer = Buffer.from(matches[1], 'base64');
        var pdfDir = path.join(getAssetsDir(), 'contracts');
        if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
        var fileName = 'contract_new_' + Date.now() + '.pdf';
        fs.writeFileSync(path.join(pdfDir, fileName), buffer);
        contractFile = 'assets/contracts/' + fileName;
      }
    }
    var result = Database.query(
      "INSERT INTO contracts (artist_id, artist_name, positions, brand, gender, id_card, phone, start_date, end_date, contract_no, sign_status, contract_file) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [0, data.name, posJson, data.brand || '', data.gender || '', data.idNumber || '', data.phone || '',
       data.startDate || '', data.endDate || '', data.contractNo || '', data.signStatus || '未签约', contractFile]
    );
    return { ok: true, data: { id: result.lastInsertRowid } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('update-contract', (event, data) => {
  try {
    var posJson = JSON.stringify((data.position || '').split(/[,，;]\s*/).map(function(p) { return p.trim(); }).filter(function(p) { return p; }));
    var contractFile = data.contractFile;
    var hasNewFile = contractFile && contractFile.startsWith('data:application/pdf;base64,');
    if (hasNewFile) {
      var matches = contractFile.match(/^data:application\/pdf;base64,(.+)$/);
      if (matches) {
        var buffer = Buffer.from(matches[1], 'base64');
        var pdfDir = path.join(getAssetsDir(), 'contracts');
        if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
        var fileName = 'contract_' + data.id + '_' + Date.now() + '.pdf';
        fs.writeFileSync(path.join(pdfDir, fileName), buffer);
        contractFile = 'assets/contracts/' + fileName;
      }
    }
    if (hasNewFile) {
      Database.query(
        "UPDATE contracts SET artist_name=?, positions=?, brand=?, gender=?, id_card=?, phone=?, start_date=?, end_date=?, contract_no=?, sign_status=?, contract_file=? WHERE id=?",
        [data.name, posJson, data.brand || '', data.gender || '', data.idNumber || '', data.phone || '',
         data.startDate || '', data.endDate || '', data.contractNo || '', data.signStatus || '未签约', contractFile, data.id]
      );
    } else {
      Database.query(
        "UPDATE contracts SET artist_name=?, positions=?, brand=?, gender=?, id_card=?, phone=?, start_date=?, end_date=?, contract_no=?, sign_status=? WHERE id=?",
        [data.name, posJson, data.brand || '', data.gender || '', data.idNumber || '', data.phone || '',
         data.startDate || '', data.endDate || '', data.contractNo || '', data.signStatus || '未签约', data.id]
      );
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('add-salaries', (event, salaryList) => {
  try {
    Database.query('BEGIN');
    var count = 0;
    (salaryList || []).forEach(function(sd) {
      var total = (sd.monthlySalary || 0) + (sd.teamFee || 0) + (sd.travelFee || 0) + (sd.rentUtilityFee || 0);
      Database.query(
        "INSERT INTO salaries (month, store_name, nature, artist_name, position, daily_salary, performance_days, monthly_salary, team_fee, travel_fee, rent_utility_fee, total_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [sd.month || '', sd.store || '', sd.nature || '', sd.name || '', sd.position || '',
         sd.dailySalary || 0, sd.performanceDays || 0, sd.monthlySalary || 0, sd.teamFee || 0, sd.travelFee || 0, sd.rentUtilityFee || 0, total]
      );
      count++;
    });
    Database.query('COMMIT');
    return { ok: true, data: { count: count } };
  } catch (err) {
    try { Database.query('ROLLBACK'); } catch(_) {}
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('add-evaluations', (event, evalList) => {
  try {
    Database.query('BEGIN');
    var count = 0;
    (evalList || []).forEach(function(ed) {
      Database.query(
        "INSERT INTO evaluations (artist_id, artist_name, store_name, overall_score, responsibility_score, stability_score, teamwork_score, adaptability_score, business_score, tags, comment, evaluated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [0, ed.name || '', ed.store || '', ed.overallScore || 0,
         ed.responsibilityScore || 0, ed.stabilityScore || 0, ed.teamworkScore || 0,
         ed.adaptabilityScore || 0, ed.businessScore || 0,
         JSON.stringify(ed.tags || []), ed.comment || '', ed.evaluatedAt || '']
      );
      count++;
    });
    Database.query('COMMIT');
    return { ok: true, data: { count: count } };
  } catch (err) {
    try { Database.query('ROLLBACK'); } catch(_) {}
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('save-artist-photos', (event, artistId, photosJson) => {
  try {
    Database.query(
      "UPDATE artists SET photos=?, updated_at=datetime('now','localtime') WHERE id=?",
      [photosJson || '[]', artistId]
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ===== 视频管理 =====

ipcMain.handle('copy-video-file', async (event, artistId, filePath, fileName) => {
  try {
    var ext = path.extname(filePath).toLowerCase().replace('.', '');
    if (ext === 'quicktime') ext = 'mov';
    var videoDir = path.join(getAssetsDir(), 'videos');
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    var videoId = 'v_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    var safeName = videoId + '.' + ext;
    var destPath = path.join(videoDir, safeName);
    fs.copyFileSync(filePath, destPath);
    var stat = fs.statSync(destPath);
    var relativePath = 'assets/videos/' + safeName;

    // Update artist's videos JSON column
    var rows = Database.query('SELECT videos FROM artists WHERE id = ?', [artistId]);
    if (!rows || rows.length === 0) return { ok: false, error: '艺人不存在' };
    var videos = [];
    try { videos = JSON.parse(rows[0].videos || '[]'); } catch(_) {}
    videos.push({
      id: videoId,
      fileName: fileName,
      serverPath: relativePath,
      size: stat.size,
      mimeType: 'video/' + ext,
      uploadedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
    Database.query(
      "UPDATE artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?",
      [JSON.stringify(videos), artistId]
    );
    return { ok: true, path: relativePath, videoId: videoId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('read-video-file', async (event, filePath) => {
  try {
    var fullPath = resolveAssetPath(filePath);
    if (!fullPath || !fs.existsSync(fullPath)) return { ok: false, error: '文件不存在' };
    var buffer = fs.readFileSync(fullPath);
    var ext = path.extname(fullPath).replace('.', '');
    if (ext === 'mov') ext = 'quicktime';
    var base64 = buffer.toString('base64');
    return { ok: true, data: 'data:video/' + ext + ';base64,' + base64 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('delete-artist-video', async (event, artistId, videoId) => {
  try {
    var rows = Database.query('SELECT videos FROM artists WHERE id = ?', [artistId]);
    if (!rows || rows.length === 0) return { ok: false, error: '艺人不存在' };
    var videos = [];
    try { videos = JSON.parse(rows[0].videos || '[]'); } catch(_) {}
    var target = null;
    for (var i = 0; i < videos.length; i++) {
      if (videos[i].id === videoId) { target = videos[i]; videos.splice(i, 1); break; }
    }
    // Delete physical file
    if (target && target.serverPath) {
      var fullPath = resolveAssetPath(target.serverPath);
      if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    Database.query(
      "UPDATE artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?",
      [JSON.stringify(videos), artistId]
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('save-artist-videos', async (event, artistId, videosJson) => {
  try {
    Database.query(
      "UPDATE artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?",
      [videosJson || '[]', artistId]
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('reset-all-data', () => {
  try {
    Database.query('DELETE FROM salaries');
    Database.query('DELETE FROM evaluations');
    Database.query('DELETE FROM contracts');
    Database.query('DELETE FROM announcements');
    Database.query("UPDATE artists SET status = '-1'");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ===== 音乐部文件公告 =====

ipcMain.handle('get-announcements', () => {
  try {
    var rows = Database.query('SELECT * FROM announcements ORDER BY created_at DESC');
    return { ok: true, data: (rows || []).map(function(a) {
      return {
        id: a.id,
        title: a.title || '',
        fileName: a.file_name || '',
        filePath: a.file_path || '',
        createdAt: a.created_at ? a.created_at.slice(0, 19) : ''
      };
    }) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('add-announcement', async (event, data) => {
  try {
    var filePath = '';
    if (data.fileData && data.fileData.startsWith('data:application/pdf;base64,')) {
      var matches = data.fileData.match(/^data:application\/pdf;base64,(.+)$/);
      if (matches) {
        var buffer = Buffer.from(matches[1], 'base64');
        var pdfDir = path.join(getAssetsDir(), 'announcements');
        if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
        var safeName = (data.fileName || 'file.pdf').replace(/[^a-zA-Z0-9_\-.一-龥]/g, '_');
        var announceFileName = Date.now() + '_' + safeName;
        filePath = 'assets/announcements/' + announceFileName;
        fs.writeFileSync(path.join(getAssetsDir(), 'announcements', announceFileName), buffer);
      }
    }
    var result = Database.query(
      "INSERT INTO announcements (title, file_name, file_path) VALUES (?,?,?)",
      [data.title || '', data.fileName || '', filePath]
    );
    return { ok: true, data: { id: result.lastInsertRowid } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('delete-announcement', async (event, id) => {
  try {
    var rows = Database.query('SELECT file_path FROM announcements WHERE id = ?', [id]);
    if (rows && rows.length > 0 && rows[0].file_path) {
      var fullPath = resolveAssetPath(rows[0].file_path);
      if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    Database.query('DELETE FROM announcements WHERE id = ?', [id]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('read-announcement-file', async (event, filePath) => {
  try {
    var fullPath = resolveAssetPath(filePath);
    if (!fullPath || !fs.existsSync(fullPath)) return { ok: false, error: '文件不存在' };
    var buffer = fs.readFileSync(fullPath);
    var base64 = buffer.toString('base64');
    return { ok: true, data: 'data:application/pdf;base64,' + base64 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ===== Update IPC handlers =====

ipcMain.handle('check-for-update', function() {
  try {
    const { autoUpdater } = require('electron-updater');
    return autoUpdater.checkForUpdates();
  } catch(err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('download-update', function() {
  try {
    const { autoUpdater } = require('electron-updater');
    return autoUpdater.downloadUpdate();
  } catch(err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('quit-and-install', function() {
  try {
    // 1. 清掉所有可能阻止退出的监听器
    app.removeAllListeners('window-all-closed');
    app.removeAllListeners('before-quit');
    app.removeAllListeners('will-quit');

    // 2. 强制销毁窗口
    if (mainWindow) {
      mainWindow.removeAllListeners('close');
      mainWindow.destroy();
      mainWindow = null;
    }

    // 3. 调用 quitAndInstall 让它注册安装器启动任务
    const { autoUpdater } = require('electron-updater');
    autoUpdater.quitAndInstall(true, true);

    // 4. 延迟 500ms 后如果还没退出，强制杀进程
    // quitAndInstall 内部调用 app.quit() 是异步的，这个兜底确保进程一定死
    setTimeout(function() {
      app.exit(0);
    }, 500);
  } catch(err) {
    app.exit(0);
  }
});

// ===== Artist media lazy-load =====

ipcMain.handle('get-artist-media', function(event, artistId) {
  try {
    var rows = Database.query('SELECT photos, videos FROM artists WHERE id = ?', [artistId]);
    if (!rows || rows.length === 0) return { ok: true, data: { photos: '[]', videos: '[]' } };
    return { ok: true, data: { photos: rows[0].photos || '[]', videos: rows[0].videos || '[]' } };
  } catch(err) {
    return { ok: false, error: err.message };
  }
});
