// 修复储备艺人视频的 serverPath 脏数据
// 问题：前端上传视频后，serverPath 被空字符串覆盖
// 修复：扫描 assets/videos/ 目录，重建 serverPath 映射
//
// 用法（在云端服务器执行）：
//   node scripts/fix-video-serverpath.js

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'artist_data.db');
const VIDEOS_DIR = path.join(__dirname, '..', 'server', 'src', 'assets', 'videos');

console.log('数据库:', DB_PATH);
console.log('视频目录:', VIDEOS_DIR);

const db = new Database(DB_PATH);

// 1. 扫描 videos 目录，建立 serverPath → 真实路径的映射
const filesOnDisk = {};
if (fs.existsSync(VIDEOS_DIR)) {
  const files = fs.readdirSync(VIDEOS_DIR);
  files.forEach(function(f) {
    const fullPath = path.join(VIDEOS_DIR, f);
    if (fs.statSync(fullPath).isFile()) {
      const relativePath = 'assets/videos/' + f;
      filesOnDisk[relativePath] = {
        path: relativePath,
        size: fs.statSync(fullPath).size,
        mtime: fs.statSync(fullPath).mtime
      };
    }
  });
  console.log('磁盘上找到 ' + Object.keys(filesOnDisk).length + ' 个视频文件');
} else {
  console.log('视频目录不存在: ' + VIDEOS_DIR);
  process.exit(1);
}

// 2. 查所有储备艺人的视频
const rows = db.prepare("SELECT id, name, videos FROM reserve_artists WHERE COALESCE(status,'') != '-1'").all();
let fixedCount = 0;
let unfixableCount = 0;

rows.forEach(function(row) {
  let videos = [];
  try { videos = JSON.parse(row.videos || '[]'); } catch(e) { return; }
  if (videos.length === 0) return;

  let modified = false;

  videos.forEach(function(video, idx) {
    if (video.serverPath && video.serverPath !== '') {
      // Already has a valid serverPath
      return;
    }

    // Try to find the file by:
    // (a) Match by video.id in filename
    // (b) Match by fileName pattern
    // (c) Match by upload time proximity

    let foundPath = null;

    // Strategy 1: Look for filenames containing the video id
    for (var diskPath in filesOnDisk) {
      if (diskPath.indexOf(video.id) !== -1) {
        foundPath = diskPath;
        break;
      }
    }

    // Strategy 2: Match by file size and MIME type
    if (!foundPath && video.size) {
      for (var dp in filesOnDisk) {
        if (filesOnDisk[dp].size === video.size) {
          foundPath = dp;
          break;
        }
      }
    }

    if (foundPath) {
      video.serverPath = foundPath;
      if (!video.size || video.size === 0) {
        video.size = filesOnDisk[foundPath].size;
      }
      modified = true;
      fixedCount++;
      console.log('✓ ' + row.name + ' 视频#' + (idx+1) + ': ' + video.fileName + ' → ' + foundPath);
    } else {
      unfixableCount++;
      console.log('✗ ' + row.name + ' 视频#' + (idx+1) + ': ' + video.fileName + ' — 未找到对应文件');
    }
  });

  if (modified) {
    db.prepare("UPDATE reserve_artists SET videos=?, updated_at=datetime('now','localtime') WHERE id=?")
      .run(JSON.stringify(videos), row.id);
  }
});

console.log('');
console.log('=== 修复完成 ===');
console.log('修复: ' + fixedCount + ' 个视频');
console.log('无法修复: ' + unfixableCount + ' 个视频（需重新上传）');
db.close();
