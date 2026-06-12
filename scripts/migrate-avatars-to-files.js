// 头像迁移：将数据库中的 base64 头像提取为文件
// 用法：node scripts/migrate-avatars-to-files.js

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'artist_data.db');
const AVATARS_DIR = path.join(__dirname, '..', 'server', 'src', 'assets', 'avatars');

console.log('数据库:', DB_PATH);
console.log('头像目录:', AVATARS_DIR);

if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// ============ 艺人头像 ============
console.log('\n--- 迁移艺人头像 ---');
var artists = db.prepare("SELECT id, name, avatar FROM artists WHERE avatar LIKE 'data:image/%'").all();
var artistCount = 0;

artists.forEach(function(a) {
  try {
    var matches = a.avatar.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return;
    var ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    var buffer = Buffer.from(matches[2], 'base64');
    var fileName = 'artist_' + a.id + '.' + ext;
    var filePath = path.join(AVATARS_DIR, fileName);
    fs.writeFileSync(filePath, buffer);
    var relativePath = 'assets/avatars/' + fileName;
    db.prepare("UPDATE artists SET avatar = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(relativePath, a.id);
    artistCount++;
    console.log('  ✓ ' + a.name + ' → ' + relativePath + ' (' + buffer.length + ' bytes)');
  } catch(e) {
    console.log('  ✗ ' + a.name + ': ' + e.message);
  }
});

// ============ 储备艺人头像 ============
console.log('\n--- 迁移储备艺人头像 ---');
var reserves = db.prepare("SELECT id, name, avatar FROM reserve_artists WHERE avatar LIKE 'data:image/%'").all();
var reserveCount = 0;

reserves.forEach(function(a) {
  try {
    var matches = a.avatar.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return;
    var ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    var buffer = Buffer.from(matches[2], 'base64');
    var fileName = 'reserve_' + a.id + '.' + ext;
    var filePath = path.join(AVATARS_DIR, fileName);
    fs.writeFileSync(filePath, buffer);
    var relativePath = 'assets/avatars/' + fileName;
    db.prepare("UPDATE reserve_artists SET avatar = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(relativePath, a.id);
    reserveCount++;
    console.log('  ✓ ' + a.name + ' → ' + relativePath + ' (' + buffer.length + ' bytes)');
  } catch(e) {
    console.log('  ✗ ' + a.name + ': ' + e.message);
  }
});

console.log('\n=== 迁移完成 ===');
console.log('艺人头像: ' + artistCount + ' 个');
console.log('储备头像: ' + reserveCount + ' 个');
console.log('总计: ' + (artistCount + reserveCount) + ' 个');
db.close();
