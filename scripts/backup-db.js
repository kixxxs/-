// 数据库备份脚本 — 安全备份 SQLite（兼容 WAL 模式），保留最近 3 份
// 用法: node scripts/backup-db.js
// cron: 0 3 * * * /usr/bin/node /app/scripts/backup-db.js >> /app/backups/backup.log 2>&1

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'artist_data.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP_COUNT = 3;

function log(msg) {
  console.log('[' + new Date().toISOString() + '] ' + msg);
}

try {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    log('数据库文件不存在: ' + DB_PATH);
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  // WAL checkpoint 确保数据一致性
  db.pragma('wal_checkpoint(TRUNCATE)');

  // 生成备份文件名
  const now = new Date();
  const ts = now.getFullYear()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0') + '_'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const backupFile = path.join(BACKUP_DIR, 'artist_data_' + ts + '.db');

  // 使用 better-sqlite3 的 backup API（安全，兼容 WAL）
  db.backup(backupFile).then(function() {
    var stat = fs.statSync(backupFile);
    log('备份完成: ' + backupFile + ' (' + Math.round(stat.size / 1024) + ' KB)');
    db.close();

    // 轮转：只保留最近 N 份
    var files = fs.readdirSync(BACKUP_DIR)
      .filter(function(f) { return f.startsWith('artist_data_') && f.endsWith('.db'); })
      .sort(); // 按文件名排序（时间戳在前）

    while (files.length > KEEP_COUNT) {
      var oldFile = path.join(BACKUP_DIR, files[0]);
      fs.unlinkSync(oldFile);
      log('删除旧备份: ' + files[0]);
      files.shift();
    }
    log('当前保留 ' + files.length + ' 份备份');
  }).catch(function(err) {
    log('备份失败: ' + err.message);
    db.close();
    process.exit(1);
  });

} catch(e) {
  log('错误: ' + e.message);
  process.exit(1);
}
