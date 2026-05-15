const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('./db/db/database.js');

let mainWindow;

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

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  createWindow();
  await Database.init();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('db-query', (event, sql, params) => {
  try {
    return { ok: true, data: Database.query(sql, params) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

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
    const pdfDir = path.join(__dirname, 'src', 'assets', 'contracts');
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
    const fullPath = path.join(__dirname, 'src', filePath);
    if (!fs.existsSync(fullPath)) return { ok: false, error: '文件不存在' };
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
    const avatarDir = path.join(__dirname, 'src', 'assets', 'avatars');
    if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
    const fileName = `${artistName}_${Date.now()}.${ext}`;
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

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { ok: true, data: content };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

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
    const artists = Database.query("SELECT * FROM artists WHERE COALESCE(status,'') != '-1'");
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
            photos: a.photos || '[]',
            status: a.status || '在岗',
            level: a.business_level || 'B级',
            store: a.store_name || '',
            position: a.positions ? JSON.parse(a.positions).join(', ') : '',
            contractStatus: a.sign_status || '未签约',
            dailySalary: a.daily_salary || 0
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
    Database.query(
      "UPDATE artists SET name=?, avatar=?, status=?, business_level=?, store_name=?, positions=?, sign_status=?, daily_salary=?, updated_at=datetime('now','localtime') WHERE id=?",
      [data.name, data.avatar || '', data.status || '在岗', data.level || 'B级', data.store || '',
       posJson, data.contractStatus || '未签约', data.dailySalary || 0, data.id]
    );
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
        var pdfDir = path.join(__dirname, 'src', 'assets', 'contracts');
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
        var pdfDir = path.join(__dirname, 'src', 'assets', 'contracts');
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
    return { ok: true, data: { count: count } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('add-evaluations', (event, evalList) => {
  try {
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
    return { ok: true, data: { count: count } };
  } catch (err) {
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
        var pdfDir = path.join(__dirname, 'src', 'assets', 'announcements');
        if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
        var safeName = (data.fileName || 'file.pdf').replace(/[^a-zA-Z0-9_\-.一-龥]/g, '_');
        filePath = 'assets/announcements/' + Date.now() + '_' + safeName;
        fs.writeFileSync(path.join(__dirname, 'src', filePath), buffer);
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
      var fullPath = path.join(__dirname, 'src', rows[0].file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    Database.query('DELETE FROM announcements WHERE id = ?', [id]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('read-announcement-file', async (event, filePath) => {
  try {
    var fullPath = path.join(__dirname, 'src', filePath);
    if (!fs.existsSync(fullPath)) return { ok: false, error: '文件不存在' };
    var buffer = fs.readFileSync(fullPath);
    var base64 = buffer.toString('base64');
    return { ok: true, data: 'data:application/pdf;base64,' + base64 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
