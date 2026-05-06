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
app.use(express.json({ limit: '50mb' }));

// ===== Login accounts (same as frontend) =====
var LOGIN_ACCOUNTS = [
    { account: 'admin',    password: 'admin123',   label: '管理员' },
    { account: 'manager1', password: 'mgr123456',  label: '经理 - 张伟' },
    { account: 'manager2', password: 'mgr123456',  label: '经理 - 李娜' },
    { account: 'hr1',      password: 'hr123456',   label: '人事 - 王芳' },
    { account: 'hr2',      password: 'hr123456',   label: '人事 - 刘洋' },
    { account: 'finance1', password: 'fin123456',  label: '财务 - 陈静' },
    { account: 'finance2', password: 'fin123456',  label: '财务 - 赵磊' },
    { account: 'store1',   password: 'store1234',  label: '门店经理 - 周明' },
    { account: 'store2',   password: 'store1234',  label: '门店经理 - 吴鑫' },
    { account: 'viewer',   password: 'view1234',   label: '访客(只读)' }
];

// ===== Token store (in-memory, survives server restart = all clients re-login) =====
var tokenStore = {}; // token -> { account, label, createdAt }

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
    if (!token) {
        token = req.query.token || '';
    }
    if (!token || !tokenStore[token]) {
        return res.status(401).json({ ok: false, error: '未登录或登录已过期' });
    }
    req.user = tokenStore[token];
    next();
}

// ===== SSE connections =====
var sseClients = [];

function broadcast(eventType, payload) {
    var data = JSON.stringify(payload);
    sseClients.forEach(function(client) {
        try {
            client.write('event: ' + eventType + '\ndata: ' + data + '\n\n');
        } catch(e) {
            // Client disconnected, will be removed on close
        }
    });
}

// ===== Login =====
app.post('/api/login', function(req, res) {
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

    var token = generateToken();
    tokenStore[token] = { account: found.account, label: found.label, createdAt: Date.now() };

    res.json({ ok: true, user: { account: found.account, label: found.label }, token: token });
});

app.post('/api/logout', authMiddleware, function(req, res) {
    var authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        var token = authHeader.slice(7);
        delete tokenStore[token];
    }
    res.json({ ok: true });
});

// ===== Data endpoints (all protected) =====

app.get('/api/data/all', authMiddleware, function(req, res) {
    try {
        var data = db.getAllData();
        res.json({ ok: true, data: data });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/artists', authMiddleware, function(req, res) {
    try {
        var result = db.addArtist(req.body);
        broadcast('artist-added', { id: result.id });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/artists/:id', authMiddleware, function(req, res) {
    try {
        req.body.id = parseInt(req.params.id, 10);
        db.updateArtist(req.body);
        broadcast('artist-updated', { id: req.body.id });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.delete('/api/artists/:id', authMiddleware, function(req, res) {
    try {
        db.deleteArtist(parseInt(req.params.id, 10));
        broadcast('artist-deleted', { id: parseInt(req.params.id, 10) });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/contracts', authMiddleware, function(req, res) {
    try {
        var result = db.addContract(req.body);
        broadcast('contract-added', { id: result.id });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/contracts/:id', authMiddleware, function(req, res) {
    try {
        req.body.id = parseInt(req.params.id, 10);
        db.updateContract(req.body);
        broadcast('contract-updated', { id: req.body.id });
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/salaries', authMiddleware, function(req, res) {
    try {
        var result = db.addSalaries(req.body);
        broadcast('salaries-added', { count: result.count });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.post('/api/evaluations', authMiddleware, function(req, res) {
    try {
        var result = db.addEvaluations(req.body);
        broadcast('evaluations-added', { count: result.count });
        res.json({ ok: true, data: result });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.put('/api/artists/:id/photos', authMiddleware, function(req, res) {
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

app.post('/api/upload/avatar', authMiddleware, function(req, res) {
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

app.post('/api/reset', authMiddleware, function(req, res) {
    try {
        db.resetAllData();
        broadcast('data-reset', {});
        res.json({ ok: true });
    } catch(err) {
        res.json({ ok: false, error: err.message });
    }
});

app.get('/api/ping', function(req, res) {
    res.json({ ok: true });
});

// ===== SSE endpoint =====
app.get('/api/events', function(req, res) {
    // Auth via query param (EventSource doesn't support custom headers)
    var token = req.query.token || '';
    if (!token || !tokenStore[token]) {
        return res.status(401).json({ ok: false, error: '未登录' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    sseClients.push(res);

    // Send initial keepalive
    res.write(':ok\n\n');

    req.on('close', function() {
        var idx = sseClients.indexOf(res);
        if (idx !== -1) sseClients.splice(idx, 1);
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
    console.log('  本地访问: http://localhost:' + PORT);
    console.log('  按 Ctrl+C 停止服务器');
    console.log('');
});
