var fs = require('fs');
var path = require('path');

var files = [
  { local: 'server.js', remote: '/app/server.js' },
  { local: 'server/database.js', remote: '/app/server/database.js' },
  { local: 'src/cap-db.js', remote: '/app/src/cap-db.js' },
  { local: 'src/index.html', remote: '/app/src/index.html' },
  { local: 'package.json', remote: '/app/package.json' }
];

var lines = [];
lines.push('#!/bin/bash');
lines.push('# Tencent Cloud Web Terminal Deploy - V9');
lines.push('');
lines.push('echo "============================================"');
lines.push('echo "  Artist Manager V9 - Web Deploy"');
lines.push('echo "============================================"');
lines.push('echo ""');
lines.push('sudo mkdir -p /app/server /app/src /app/data');
lines.push('echo "[1/3] Writing files..."');
lines.push('');

files.forEach(function(f) {
  var content = fs.readFileSync(f.local);
  var b64 = content.toString('base64');
  lines.push('echo "  ' + f.remote + '"');
  lines.push("base64 -d <<'FILEEOF' | sudo tee " + f.remote + " > /dev/null");
  for (var i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  lines.push('FILEEOF');
  lines.push('');
});

lines.push('echo ""');
lines.push('echo "[2/3] Installing dependencies..."');
lines.push('cd /app');
lines.push('sudo npm install --omit=dev');
lines.push('');
lines.push('echo ""');
lines.push('echo "[3/3] Restarting server..."');
lines.push('sudo pkill -f "node server.js" 2>/dev/null');
lines.push('sleep 1');
lines.push('sudo nohup node /app/server.js > /app/server.log 2>&1 &');
lines.push('sleep 2');
lines.push('');
lines.push('echo ""');
lines.push('echo "============================================"');
lines.push('echo "  Deploy Complete!"');
lines.push('echo "  http://42.194.230.53:8080"');
lines.push('echo "============================================"');

fs.writeFileSync(path.join(__dirname, 'web-deploy.sh'), lines.join('\n'));
console.log('Done: deploy/web-deploy.sh (' + (lines.join('\n').length / 1024).toFixed(0) + ' KB)');
