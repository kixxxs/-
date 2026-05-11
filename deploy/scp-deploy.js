// deploy/scp-deploy.js
// Runs AFTER SSH key is set up on the CVM.
// Transfers files via SCP and deploys via SSH.

const { execSync } = require('child_process');
const path = require('path');

const CVM_IP = '42.194.230.53';
const SSH_OPTS = '-o StrictHostKeyChecking=no -o ConnectTimeout=10';

console.log('[SCP-Deploy] Transferring files to CVM...');

try {
  // Transfer server files
  execSync(`scp ${SSH_OPTS} server.js root@${CVM_IP}:/app/server.js`, {
    cwd: path.join(__dirname, 'scp-payload'),
    stdio: 'inherit',
    timeout: 30000
  });
  console.log('[SCP-Deploy] ✓ server.js transferred');

  execSync(`scp ${SSH_OPTS} server/database.js root@${CVM_IP}:/app/server/database.js`, {
    cwd: path.join(__dirname, 'scp-payload'),
    stdio: 'inherit',
    timeout: 30000
  });
  console.log('[SCP-Deploy] ✓ database.js transferred');

  execSync(`scp ${SSH_OPTS} package.json root@${CVM_IP}:/app/package.json`, {
    cwd: path.join(__dirname, 'scp-payload'),
    stdio: 'inherit',
    timeout: 30000
  });
  console.log('[SCP-Deploy] ✓ package.json transferred');

  // Run deployment commands on server
  console.log('[SCP-Deploy] Running deployment on server...');
  const deployCmd = `cd /app && npm install && mkdir -p /app/data && pkill -f "node /app/server.js" 2>/dev/null || true && sleep 1 && nohup env PORT=8080 DB_PATH=/app/data/artist_data.db node /app/server.js > /app/server.log 2>&1 & && sleep 2 && echo "Server started" && curl -s http://localhost:8080/api/ping`;

  execSync(`ssh ${SSH_OPTS} root@${CVM_IP} "${deployCmd}"`, {
    stdio: 'inherit',
    timeout: 120000
  });

  console.log('[SCP-Deploy] ✓ Deployment complete!');

} catch (e) {
  console.error('[SCP-Deploy] Error:', e.message);
  console.error('[SCP-Deploy] If SSH key authentication failed, run the browser automation first:');
  console.error('[SCP-Deploy]   node deploy/tencent-deploy.js');
  process.exit(1);
}
