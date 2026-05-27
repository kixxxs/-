const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./server/database');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ===== Middleware =====
app.use(cors());
app.use(express.json({ limit: '200mb' }));

// ===== Login accounts (same as frontend) =====
var LOGIN_ACCOUNTS = [
    { account: 'admin', password: 'hezong123', label: '超级管理员', role: 'admin' },
    { account: 'coach', password: 'hz123',     label: '音乐教练',   role: 'coach' }
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

// ===== Auth middleware =====
function authMiddleware(req, res, next) {
    var authHeader = req.headers.authorization;
    var token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }
    if (!token || !tokenStore[token]) {
        return res.status(401).json({ ok: false, error: '未登录或登录已过期' });
    }
    // Check token expiry
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
    if (!found || found.password !== password) {
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
        var data = db.getAllData();
        res.json({ ok: true, data: data });
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

app.post('/api/artists/:id/videos/upload', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var artistId = parseInt(req.params.id, 10);
        var dataUrl = req.body.dataUrl;
        var fileName = req.body.fileName || 'video.mp4';
        if (!dataUrl || !dataUrl.startsWith('data:video/')) {
            return res.json({ ok: false, error: '无效的视频格式' });
        }
        var filePath = db.saveArtistVideo(artistId, dataUrl, fileName);
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

app.get('/api/videos/stream/:artistId/:videoId', function(req, res) {
    try {
        var artistId = parseInt(req.params.artistId, 10);
        var videoId = req.params.videoId;
        var video = db.getVideoStreamInfo(artistId, videoId);
        if (!video || !video.serverPath) {
            return res.status(404).json({ ok: false, error: '视频不存在' });
        }
        var filePath = path.join(__dirname, 'server', 'src', video.serverPath);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ ok: false, error: '视频文件不存在' });
        }
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
                'Content-Type': contentType
            });
            stream.pipe(res);
        } else {
            res.status(200).set({
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes'
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } catch(err) {
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: err.message });
        }
    }
});

app.get('/api/reserve-videos/stream/:id/:videoId', function(req, res) {
    try {
        var id = parseInt(req.params.id, 10);
        var videoId = req.params.videoId;
        var video = db.getReserveVideoStreamInfo(id, videoId);
        if (!video || !video.serverPath) {
            return res.status(404).json({ ok: false, error: '视频不存在' });
        }
        var filePath = path.join(__dirname, 'server', 'src', video.serverPath);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ ok: false, error: '视频文件不存在' });
        }
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
                'Content-Type': contentType
            });
            stream.pipe(res);
        } else {
            res.status(200).set({
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes'
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

app.post('/api/reserve-artists/:id/videos/upload', authMiddleware, adminMiddleware, function(req, res) {
    try {
        var dataUrl = req.body.dataUrl;
        if (!dataUrl || !dataUrl.startsWith('data:video/')) return res.json({ ok: false, error: '无效的视频格式' });
        var result = db.saveReserveVideo(parseInt(req.params.id, 10), dataUrl, req.body.fileName || '');
        broadcast('reserve-artist-updated', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true, video: result });
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
        var base64 = db.getAnnouncementFileBase64(parseInt(req.params.id, 10));
        if (!base64) return res.json({ ok: false, error: '未找到文件' });
        res.json({ ok: true, data: base64 });
    } catch(err) {
        res.json({ ok: false, error: err.message });
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
app.use('/node_modules', express.static(path.join(ROOT, 'node_modules')));
app.use('/src', express.static(path.join(ROOT, 'src')));
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
