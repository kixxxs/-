// lighthouse-deploy-v2.js
// More reliable: splits base64 into small chunks, checks env first

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_IP = '42.194.230.53';
const LH_URL = 'https://console.cloud.tencent.com/lighthouse/instance';

// Build tarball
const tarball = execSync(
  'tar czf - server.js server/database.js package.json',
  { cwd: path.join(__dirname, 'scp-payload'), maxBuffer: 10 * 1024 * 1024 }
);
const b64 = tarball.toString('base64');

// Split base64 into small chunks (300 chars each) for reliable typing
const CHUNK_SIZE = 300;
const chunks = [];
for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
  chunks.push(b64.slice(i, i + CHUNK_SIZE));
}
console.log('[LH] Base64 split into', chunks.length, 'chunks of ~' + CHUNK_SIZE + ' chars each');

// Build deployment commands
const deployLines = [];

// First: diagnostics and environment setup
deployLines.push('echo "=== ENV CHECK ==="');
deployLines.push('which node && node -v || echo "NO_NODE"');
deployLines.push('which npm && npm -v || echo "NO_NPM"');
deployLines.push('which python3 || which python || echo "NO_PYTHON"');
deployLines.push('which make || echo "NO_MAKE"');
deployLines.push('which g++ || echo "NO_GPP"');

// Install build tools if missing
deployLines.push('apt-get update -qq && apt-get install -y -qq python3 make g++ 2>&1 | tail -3');

// Check if Node.js exists, install if missing
deployLines.push('which node || (curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs)');

// Setup directories
deployLines.push('mkdir -p /app/server /app/data && rm -f /tmp/b64.*');

// Write base64 chunks to temp files
for (let i = 0; i < chunks.length; i++) {
  deployLines.push(`echo "${chunks[i]}" > /tmp/b64.${i}`);
}

// Decode and extract
deployLines.push(`cat /tmp/b64.* | tr -d '\\n' | base64 -d | tar xzf - -C /app && echo "EXTRACT_OK" || echo "EXTRACT_FAIL"`);
deployLines.push('ls -la /app/');
deployLines.push('rm -f /tmp/b64.*');

// Install and start
deployLines.push('cd /app && npm install 2>&1 | tail -5');
deployLines.push('pkill -f "node /app/server.js" 2>/dev/null; sleep 1');
deployLines.push('nohup env PORT=8080 DB_PATH=/app/data/artist_data.db node /app/server.js > /app/server.log 2>&1 &');
deployLines.push('sleep 3');
deployLines.push('ps aux | grep "node /app/server" | grep -v grep || (echo "SERVER_FAILED:" && cat /app/server.log)');
deployLines.push('curl -s http://localhost:8080/api/ping && echo "API_OK" || echo "API_FAIL"');
deployLines.push('echo "=== DONE ==="');

// Save for reference
fs.writeFileSync(path.join(__dirname, 'lh-deploy-v2.sh'), deployLines.join('\n'));
console.log('[LH] Script saved. Total commands:', deployLines.length);

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1400,900']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  let termPage = null;
  context.on('page', p => { termPage = p; console.log('[LH] Terminal opened'); });

  try {
    console.log('[LH] Opening Lighthouse console...');
    await page.goto(LH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);

    if (page.url().includes('login')) {
      console.log('[LH] Login required — please log in...');
      await page.waitForURL('**/lighthouse/**', { timeout: 300000 }).catch(() => {});
      console.log('[LH] ✓ Logged in');
      await page.waitForTimeout(5000);
    }

    // Find instance and click login
    const loginBtn = page.locator('a:has-text("登录"), button:has-text("登录")').first();
    const btnCount = await loginBtn.count();
    console.log('[LH] Login buttons:', btnCount);

    if (btnCount > 0) {
      await loginBtn.click();
      console.log('[LH] ✓ Clicked login');
      await page.waitForTimeout(8000);
    }

    if (!termPage) {
      console.log('[LH] No terminal popup detected. Waiting...');
      await page.waitForTimeout(5000);
    }

    if (termPage) {
      console.log('[LH] Terminal ready!');
      await termPage.waitForTimeout(5000);

      // Focus
      await termPage.locator('body').click().catch(() => {});
      await termPage.waitForTimeout(1000);

      // Execute commands one by one with wait between them
      for (let i = 0; i < deployLines.length; i++) {
        const cmd = deployLines[i];
        const isChunk = cmd.startsWith('echo "') && cmd.includes('/tmp/b64.');

        if (isChunk && i % 5 === 0) {
          console.log('[LH] Sending chunks', i - deployLines.findIndex(l => l.includes('/tmp/b64.')), '/', chunks.length);
        } else if (!isChunk) {
          console.log('[LH] Cmd', i + 1, '/', deployLines.length, ':', cmd.slice(0, 70));
        }

        // Type command
        await termPage.keyboard.type(cmd, { delay: 5 });
        await termPage.keyboard.press('Enter');

        // Wait for execution (longer for apt-get and npm install)
        if (cmd.includes('apt-get')) {
          await termPage.waitForTimeout(30000);
        } else if (cmd.includes('npm install')) {
          await termPage.waitForTimeout(60000);
        } else if (cmd.includes('nodejs')) {
          await termPage.waitForTimeout(30000);
        } else if (cmd.includes('cat /tmp/b64')) {
          await termPage.waitForTimeout(3000);
        } else {
          await termPage.waitForTimeout(2000);
        }
      }

      console.log('[LH] All commands executed!');
      await termPage.waitForTimeout(3000);
      await termPage.screenshot({ path: path.join(__dirname, 'lh-done-v2.png') });
    }

    console.log('[LH] Keeping browser open 3 minutes...');
    await page.waitForTimeout(180000);

  } catch (err) {
    console.error('[LH] Error:', err.message);
  } finally {
    await browser.close();
    console.log('[LH] Done.');
  }
})();
