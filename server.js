const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./server/database');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ===== Middleware =====
app.use(cors());
app.use(express.json({ limit: '200mb' }));

// ===== Login accounts (passwords stored as SHA-256 hashes; override via env vars) =====
// Set ADMIN_PASSWORD_HASH / COACH_PASSWORD_HASH env vars to override default hashes
var ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || 'c2dfc2cdab8e91b65c7a2990dfbc912aa1f1c8038e666d7c49c307b37d0b14b5';
var COACH_PASSWORD_HASH = process.env.COACH_PASSWORD_HASH || '52451e5b7c014ecbe34ed225668f6fbb53222e6bb8bb19954e6096ffbb8dfa9d';

var LOGIN_ACCOUNTS = [
    { account: 'admin', passwordHash: ADMIN_PASSWORD_HASH, label: '超级管理员', role: 'admin' },
    { account: 'coach', passwordHash: COACH_PASSWORD_HASH, label: '音乐教练',   role: 'coach' }
];

// ===== Token store (in-memory, survives server restart = all clients re-login) =====
var tokenStore = {}; // token -> { account, label, createdAt }

// ===== Rate limiter for login =====
var loginAttempts = {}; // ip -> { count, firstAttempt }

function isRateLimited(ip) {
    var now = Date.now();
    var entry = loginAttempts[ip];
    if (!entry || now - entry.firstAttempt > 60000) {
        loginAttempts[ip] = { count: 1, firstAttempt: now };
        return false;
    }
    entry.count++;
    if (entry.count > 5) return true;
    return false;
}

// Periodic cleanup of expired tokens and login attempts
setInterval(function() {
    var now = Date.now();
    var expired = [];
    for (var t in tokenStore) {
        if (now - tokenStore[t].createdAt > 24 * 60 * 60 * 1000) {
            expired.push(t);
        }
    }
    expired.forEach(function(t) { delete tokenStore[t]; });
    // Cleanup old login attempts
    for (var ip in loginAttempts) {
        if (now - loginAttempts[ip].firstAttempt > 60000) {
            delete loginAttempts[ip];
        }
    }
}, 60000);

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ===== Auth middleware (standard: Authorization header only) =====
function authMiddleware(req, res, next) {
    var authHeader = req.headers.authorization;
    var token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }
    if (!token || !tokenStore[token]) {
        return res.status(401).json({ ok: false, error: '未登录或登录已过期' });
    }
    if (tokenStore[token].createdAt && Date.now() - tokenStore[token].createdAt > 24 * 60 * 60 * 1000) {
        delete tokenStore[token];
        return res.status(401).json({ ok: false, error: '登录已过期，请重新登录' });
    }
    req.user = tokenStore[token];
    next();
}

// ===== Video auth middleware — accepts token via header OR query parameter =====
// Query param is needed because <video> tags cannot set custom HTTP headers
function videoAuthMiddleware(req, res, next) {
    var token = null;
    var authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }
    if (!token) {
        token = req.query.token || '';
    }
    if (!token || !tokenStore[token]) {
        return res.status(401).json({ ok: false, error: '未登录或登录已过期' });
    }
    if (tokenStore[token].createdAt && Date.now() - tokenStore[token].createdAt > 24 * 60 * 60 * 1000) {
        delete tokenStore[token];
        return res.status(401).json({ ok: false, error: '登录已过期，请重新登录' });
    }
    req.user = tokenStore[token];
    next();
}

// ===== SSE connections =====
var sseClients = {}; // token -> res

function broadcast(eventType, payload) {
    var data = JSON.stringify(payload);
    for (var t in sseClients) {
        try {
            sseClients[t].write('event: ' + eventType + '\ndata: ' + data + '\n\n');
        } catch(e) {
            delete sseClients[t];
        }
    }
}

// ===== Version / Update endpoint (public) =====

function getVersionInfo() {
  var infoPath = path.join(ROOT, 'updates', 'version-info.json');
  if (fs.existsSync(infoPath)) {
    try { return JSON.parse(fs.readFileSync(infoPath, 'utf-8')); } catch(_) {}
  }
  // Fallback: parse latest.yml for desktop version
  var result = { desktop: null, android: null, ios: null };
  var latestYml = path.join(ROOT, 'updates', 'latest.yml');
  if (fs.existsSync(latestYml)) {
    var yml = fs.readFileSync(latestYml, 'utf-8');
    var vMatch = yml.match(/^version:\s*(.+)$/m);
    if (vMatch) result.desktop = { version: vMatch[1].trim() };
  }
  // Check for APK
  var apkPath = path.join(ROOT, 'updates', 'artist-manager.apk');
  if (fs.existsSync(apkPath)) {
    var apkStat = fs.statSync(apkPath);
    result.android = {
      versionCode: result.android ? result.android.versionCode : 1,
      versionName: result.desktop ? result.desktop.version : '1.0.0',
      apkUrl: '/updates/artist-manager.apk',
      apkSize: apkStat.size
    };
  }
  // Check for iOS manifest
  var plistPath = path.join(ROOT, 'updates', 'manifest.plist');
  if (fs.existsSync(plistPath)) {
    var plist = fs.readFileSync(plistPath, 'utf-8');
    var vMatch2 = plist.match(/<key>bundle-version<\/key>\s*<string>([^<]+)<\/string>/);
    var ipaPath = path.join(ROOT, 'updates', 'artist-manager.ipa');
    var ipaSize = 0;
    if (fs.existsSync(ipaPath)) { ipaSize = fs.statSync(ipaPath).size; }
    result.ios = {
      version: vMatch2 ? vMatch2[1].trim() : '1.0.0',
      ipaUrl: '/updates/artist-manager.ipa',
      ipaSize: ipaSize
    };
  }
  return result;
}

app.get('/api/version', function(req, res) {
  try {
    res.json({ ok: true, data: getVersionInfo() });
  } catch(err) {
    res.json({ ok: false, error: err.message });
  }
});

// ===== Static file serving for update artifacts =====

var updatesDir = path.join(ROOT, 'updates');
if (!fs.existsSync(updatesDir)) { fs.mkdirSync(updatesDir, { recursive: true }); }
app.use('/updates', express.static(updatesDir, {
  maxAge: 0,
  setHeaders: function(res, filePath) {
    if (filePath.endsWith('.yml')) {
      res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    } else if (filePath.endsWith('.plist')) {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    }
  }
}));

// ===== Artist media lazy-load =====

app.get('/api/artists/:id/media', authMiddleware, function(req, res) {
  try {
    var media = db.getArtistMedia(parseInt(req.params.id, 10));
    res.json({ ok: true, data: media });
  } catch(err) {
    res.json({ ok: false, error: err.message });
  }
});

app.get('/api/reserve-artists/:id/media', authMiddleware, function(req, res) {
  try {
    var media = db.getReserveArtistMedia(parseInt(req.params.id, 10));
    res.json({ ok: true, data: media });
  } catch(err) {
    res.json({ ok: false, error: err.message });
  }
});

// ===== 头像文件服务（长期缓存） =====
app.get('/api/avatars/:filename', function(req, res) {
  var safeName = req.params.filename.replace(/[^a-zA-Z0-9_.-]/g, '');
  var filePath = path.join(__dirname, 'server', 'src', 'assets', 'avatars', safeName);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  var ext = path.extname(safeName).toLowerCase();
  var mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
  res.set({
    'Content-Type': mimeMap[ext] || 'image/jpeg',
    'Cache-Control': 'public, max-age=31536000, immutable'
  });
  fs.createReadStream(filePath).pipe(res);
});

// ===== Login =====
app.post('/api/login', function(req, res) {
    var ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({ ok: false, error: '尝试次数过多，请1分钟后再试' });
    }

    var account = (req.body.account || '').trim();
    var password = (req.body.password || '');

    if (!account || !password) {
        return res.json({ ok: false, error: '请输入账户和密码' });
    }

    var found = null;
    for (var i = 0; i < LOGIN_ACCOUNTS.length; i++) {
        if (LOGIN_ACCOUNTS[i].account === account) { found = LOGIN_ACCOUNTS[i]; break; }
    }
    var inputHash = crypto.createHash('sha256').update(password).digest('hex');
    if (!found || found.passwordHash !== inputHash) {
        return res.json({ ok: false, error: '账户或密码错误，请重试' });
    }

    // Successful login - clear rate limit
    delete loginAttempts[ip];

    var token = generateToken();
    tokenStore[token] = { account: found.account, label: found.label, role: found.role || 'coach', createdAt: Date.now() };

    res.json({ ok: true, user: { account: found.account, label: found.label, role: found.role || 'coach' }, token: token });
});

app.post('/api/logout', authMiddleware, function(req, res) {
    var authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        var token = authHeader.slice(7);
        delete tokenStore[token];
    }
    res.json({ ok: true });
});

// ===== Admin-only middleware =====
function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ ok: false, error: '仅超级管理员可执行此操作' });
    }
    next();
}

// ===== Data endpoints (all protected) =====

app.get('/api/data/all', authMiddleware, function(req, res) {
    try {
        // ETag based on DB stats — cheap to compute, changes on any mutation
        var etag = db.getDataETag();
        var clientETag = req.headers['if-none-match'] || '';
        if (clientETag && clientETag === etag) {
            res.status(304).set('ETag', etag);
            return res.end();
        }
        var tables = (req.query.tables || '').split(',').filter(Boolean);
        var data = tables.length > 0 ? db.getPartialData(tables) : db.getAllData();
        res.set('ETag', etag).set('Cache-Control', 'private, max-age=0').json({ ok: true, data: data });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/artists', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var result = db.addArtist(req.body);
        broadcast('artist-added', { id: result.id });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/artists/:id', authMiddleware, adminMiddleware, function(req, res) {
    try {
        req.body.id = parseInt(req.params.id, 10);
        db.updateArtist(req.body);
        broadcast('artist-updated', { id: req.body.id });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.delete('/api/artists/:id', authMiddleware, adminMiddleware, function(req, res) {
    try {
        db.deleteArtist(parseInt(req.params.id, 10));
        broadcast('artist-deleted', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/contracts', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var result = db.addContract(req.body);
        broadcast('contract-added', { id: result.id });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/contracts/:id', authMiddleware, adminMiddleware, function(req, res) {
    try {
        req.body.id = parseInt(req.params.id, 10);
        db.updateContract(req.body);
        broadcast('contract-updated', { id: req.body.id });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.get('/api/contracts/:id/file', authMiddleware, function(req, res) {
    try {
        var contracts = db.getAllData().contracts;
        var contract = contracts.find(function(c) { return c.id === parseInt(req.params.id, 10); });
        if (!contract || !contract.contractFile) {
            return res.json({ ok: false, error: '未找到合约文件' });
        }
        var base64 = db.getContractFileBase64(contract.contractFile);
        res.json({ ok: true, data: base64 });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/salaries', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var result = db.addSalaries(req.body);
        broadcast('salaries-added', { count: result.count });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/evaluations', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var result = db.addEvaluations(req.body);
        broadcast('evaluations-added', { count: result.count });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/artists/:id/photos', authMiddleware, adminMiddleware, function(req, res) {
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

app.post('/api/upload/avatar', authMiddleware, adminMiddleware, function(req, res) {
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

app.post('/api/reset', authMiddleware, adminMiddleware, function(req, res) {
    try {
        db.resetAllData();
        broadcast('data-reset', {});
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

// ===== 艺人视频管理 =====

app.post('/api/artists/:id/videos/upload', authMiddleware, adminMiddleware, upload.single('video'), function(req, res) {
    try {
        var artistId = parseInt(req.params.id, 10);
        var filePath;
        if (req.file) {
            // 新方式：FormData 流式上传
            filePath = db.saveArtistVideo(artistId, { buffer: req.file.buffer, mimeType: req.file.mimetype, fileName: req.file.originalname });
        } else if (req.body && req.body.dataUrl) {
            // 兼容旧方式：JSON base64
            filePath = db.saveArtistVideo(artistId, req.body.dataUrl, req.body.fileName || 'video.mp4');
        } else {
            return res.json({ ok: false, error: '请选择视频文件' });
        }
        broadcast('videos-updated', { id: artistId });
        res.json({ ok: true, path: filePath });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/artists/:id/videos', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var artistId = parseInt(req.params.id, 10);
        var videosJson = req.body.videos || '[]';
        db.saveArtistVideos(artistId, videosJson);
        broadcast('videos-updated', { id: artistId });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.delete('/api/artists/:id/videos/:videoId', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var artistId = parseInt(req.params.id, 10);
        var videoId = req.params.videoId;
        db.deleteArtistVideo(artistId, videoId);
        broadcast('videos-updated', { id: artistId });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.get('/api/videos/stream/:artistId/:videoId', videoAuthMiddleware, function(req, res) {
    try {
        var artistId = parseInt(req.params.artistId, 10);
        var videoId = req.params.videoId;
        var video = db.getVideoStreamInfo(artistId, videoId);
        if (!video || !video.serverPath) {
            return res.status(404).json({ ok: false, error: '视频不存在' });
        }
        var srcBase = path.join(__dirname, 'server', 'src');
        var resolvedPath = path.resolve(srcBase, video.serverPath);
        if (!resolvedPath.startsWith(srcBase + path.sep) || !fs.existsSync(resolvedPath)) {
            return res.status(404).json({ ok: false, error: '视频文件不存在' });
        }
        var filePath = resolvedPath;
        var stat = fs.statSync(filePath);
        var fileSize = stat.size;
        var contentType = video.mimeType || 'video/mp4';
        var range = req.headers.range;
        if (range) {
            var parts = range.replace(/bytes=/, '').split('-');
            var start = parseInt(parts[0], 10);
            var end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            if (start >= fileSize) {
                res.status(416).set('Content-Range', 'bytes */' + fileSize);
                return res.end();
            }
            var chunkSize = (end - start) + 1;
            var stream = fs.createReadStream(filePath, { start: start, end: end });
            res.status(206).set({
                'Content-Range': 'bytes ' + start + '-' + end + '/' + fileSize,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400'
            });
            stream.pipe(res);
        } else {
            res.status(200).set({
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } catch(err) {
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: err.message });
        }
    }
});

app.get('/api/reserve-videos/stream/:id/:videoId', videoAuthMiddleware, function(req, res) {
    try {
        var id = parseInt(req.params.id, 10);
        var videoId = req.params.videoId;
        var video = db.getReserveVideoStreamInfo(id, videoId);
        if (!video || !video.serverPath) {
            return res.status(404).json({ ok: false, error: '视频不存在' });
        }
        var srcBase = path.join(__dirname, 'server', 'src');
        var resolvedPath = path.resolve(srcBase, video.serverPath);
        if (!resolvedPath.startsWith(srcBase + path.sep) || !fs.existsSync(resolvedPath)) {
            return res.status(404).json({ ok: false, error: '视频文件不存在' });
        }
        var filePath = resolvedPath;
        var stat = fs.statSync(filePath);
        var fileSize = stat.size;
        var contentType = video.mimeType || 'video/mp4';
        var range = req.headers.range;
        if (range) {
            var parts = range.replace(/bytes=/, '').split('-');
            var start = parseInt(parts[0], 10);
            var end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            if (start >= fileSize) {
                res.status(416).set('Content-Range', 'bytes */' + fileSize);
                return res.end();
            }
            var chunkSize = (end - start) + 1;
            var stream = fs.createReadStream(filePath, { start: start, end: end });
            res.status(206).set({
                'Content-Range': 'bytes ' + start + '-' + end + '/' + fileSize,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400'
            });
            stream.pipe(res);
        } else {
            res.status(200).set({
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } catch(err) {
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: err.message });
        }
    }
});

// ===== 储备艺人 API =====

app.post('/api/reserve-artists', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var result = db.addReserveArtist(req.body);
        broadcast('reserve-artist-added', { id: result.id });
        res.json({ ok: true, data: { id: result.id } });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/reserve-artists/:id', authMiddleware, adminMiddleware, function(req, res) {
    try {
        req.body.id = parseInt(req.params.id, 10);
        db.updateReserveArtist(req.body);
        broadcast('reserve-artist-updated', { id: req.body.id });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.delete('/api/reserve-artists/:id', authMiddleware, adminMiddleware, function(req, res) {
    try {
        db.deleteReserveArtist(parseInt(req.params.id, 10));
        broadcast('reserve-artist-deleted', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/reserve-artists/:id/photos', authMiddleware, adminMiddleware, function(req, res) {
    try {
        db.saveReservePhotos(parseInt(req.params.id, 10), req.body.photos || '[]');
        broadcast('reserve-artist-updated', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/reserve-artists/:id/videos', authMiddleware, adminMiddleware, function(req, res) {
    try {
        db.saveReserveVideos(parseInt(req.params.id, 10), req.body.videos || '[]');
        broadcast('reserve-artist-updated', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/reserve-artists/:id/experience', authMiddleware, adminMiddleware, function(req, res) {
    try {
        db.saveReserveExperience(parseInt(req.params.id, 10), req.body.experience || '');
        broadcast('reserve-artist-updated', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/reserve-artists/batch', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var result = db.batchAddReserveArtists(req.body);
        broadcast('reserve-artist-batch-added', { count: result.count });
        res.json({ ok: true, data: { count: result.count } });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/reserve-artists/:id/videos/upload', authMiddleware, adminMiddleware, upload.single('video'), function(req, res) {
    try {
        var result;
        if (req.file) {
            result = db.saveReserveVideo(parseInt(req.params.id, 10), { buffer: req.file.buffer, mimeType: req.file.mimetype, fileName: req.file.originalname });
        } else if (req.body && req.body.dataUrl) {
            result = db.saveReserveVideo(parseInt(req.params.id, 10), req.body.dataUrl, req.body.fileName || '');
        } else {
            return res.json({ ok: false, error: '请选择视频文件' });
        }
        broadcast('reserve-artist-updated', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true, path: result.path, videoId: result.id });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.delete('/api/reserve-artists/:id/videos/:videoId', authMiddleware, adminMiddleware, function(req, res) {
    try {
        db.deleteReserveVideo(parseInt(req.params.id, 10), req.params.videoId);
        broadcast('reserve-artist-updated', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

// ===== 音乐部文件公告 =====

app.get('/api/announcements', authMiddleware, function(req, res) {
    try {
        var data = db.getAllData();
        res.json({ ok: true, data: data.announcements || [] });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/announcements', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var result = db.addAnnouncement(req.body);
        broadcast('announcement-added', { id: result.id });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.delete('/api/announcements/:id', authMiddleware, adminMiddleware, function(req, res) {
    try {
        db.deleteAnnouncement(parseInt(req.params.id, 10));
        broadcast('announcement-deleted', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.get('/api/announcements/:id/file', authMiddleware, function(req, res) {
    try {
        var filePath = db.getAnnouncementFilePath(parseInt(req.params.id, 10));
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ ok: false, error: '未找到文件' });
        }
        var stat = fs.statSync(filePath);
        var fileSize = stat.size;
        var range = req.headers.range;

        if (range) {
            var parts = range.replace(/bytes=/, '').split('-');
            var start = parseInt(parts[0], 10);
            var end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            if (start >= fileSize) {
                res.status(416).set('Content-Range', 'bytes */' + fileSize);
                return res.end();
            }
            var chunkSize = (end - start) + 1;
            res.status(206)
                .set('Content-Range', 'bytes ' + start + '-' + end + '/' + fileSize)
                .set('Accept-Ranges', 'bytes')
                .set('Content-Length', chunkSize)
                .set('Content-Type', 'application/pdf')
                .set('Cache-Control', 'public, max-age=3600');
            fs.createReadStream(filePath, { start: start, end: end }).pipe(res);
        } else {
            res.status(200)
                .set('Content-Length', fileSize)
                .set('Content-Type', 'application/pdf')
                .set('Accept-Ranges', 'bytes')
                .set('Cache-Control', 'public, max-age=3600');
            fs.createReadStream(filePath).pipe(res);
        }
    } catch(err) {
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: err.message });
        }
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

    // Close old SSE connection for this token if it exists
    if (sseClients[token]) {
        try { sseClients[token].end(); } catch(e) {}
        delete sseClients[token];
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    sseClients[token] = res;

    // Send initial keepalive
    res.write(':ok\n\n');

    req.on('close', function() {
        if (sseClients[token] === res) {
            delete sseClients[token];
        }
    });
});

// ===== Static file serving (after API routes) =====
// Only serve specific node_modules packages needed by the frontend
var ALLOWED_MODULES = ['chart.js', 'bootstrap', 'bootstrap-icons', '@fortawesome'];
app.use('/node_modules', function(req, res, next) {
  var moduleName = req.path.split('/').filter(Boolean)[0] || '';
  if (ALLOWED_MODULES.indexOf(moduleName) === -1) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }
  express.static(path.join(ROOT, 'node_modules'))(req, res, next);
});
// /src static serving removed for security — assets are served through authenticated API endpoints
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
