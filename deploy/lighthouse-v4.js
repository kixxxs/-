// lighthouse-v4.js — simplified: force-click, wait for popup properly

const { chromium } = require('playwright');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_IP = '42.194.230.53';

// Build tarball
const tarball = execSync(
  'tar czf - server.js server/database.js package.json',
  { cwd: path.join(__dirname, 'scp-payload'), maxBuffer: 10 * 1024 * 1024 }
);
const b64 = tarball.toString('base64');

// Split into 300-char chunks
const CHUNK_SIZE = 300;
const chunks = [];
for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
  chunks.push(b64.slice(i, i + CHUNK_SIZE));
}
console.log('[v4] Chunks:', chunks.length);

// Build deploy commands
const cmds = [
  'echo "=== START ==="',
  'which node || echo NO_NODE',
  'which npm || echo NO_NPM',
  'which python3 || echo NO_PYTHON',
  'which make || echo NO_MAKE',
  'which g++ || echo NO_GPP',
  'apt-get update -qq 2>&1 | tail -2',
  'apt-get install -y -qq python3 make g++ 2>&1 | tail -3',
  'which node || (curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs) 2>&1 | tail -5',
  'echo "Node: $(node -v) NPM: $(npm -v)"',
  'mkdir -p /app/server /app/data',
  'rm -f /tmp/b64.*',
];
// Add chunk writes
for (let i = 0; i < chunks.length; i++) {
  cmds.push(`echo "${chunks[i]}" > /tmp/b64.${i}`);
}
cmds.push('cat /tmp/b64.* | tr -d "\\n" | base64 -d | tar xzf - -C /app && echo OK || echo FAIL');
cmds.push('ls -la /app/');
cmds.push('rm -f /tmp/b64.*');
cmds.push('cd /app && npm install 2>&1 | tail -5');
cmds.push('pkill -f "node /app/server.js" 2>/dev/null; sleep 1');
cmds.push('PORT=8080 DB_PATH=/app/data/artist_data.db nohup node /app/server.js > /app/server.log 2>&1 &');
cmds.push('sleep 3');
cmds.push('ps aux | grep "node /app/server" | grep -v grep || (echo FAIL; cat /app/server.log)');
cmds.push('curl -s http://localhost:8080/api/ping && echo API_OK || echo API_FAIL');
cmds.push('echo "=== DONE ==="');

console.log('[v4] Total commands:', cmds.length);

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1400,900', '--disable-popup-blocking']
  });

  const page = await browser.newPage();

  try {
    // Navigate to Lighthouse
    console.log('[v4] Opening Lighthouse...');
    await page.goto('https://console.cloud.tencent.com/lighthouse/instance', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }).catch(() => {});
    await page.waitForTimeout(5000);

    // Wait for login
    if (page.url().includes('login')) {
      console.log('[v4] Login required...');
      await page.waitForURL('**/lighthouse/**', { timeout: 300000 }).catch(() => {});
      console.log('[v4] Logged in');
      await page.waitForTimeout(8000);
    }

    // Dismiss overlays
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    // Click any "我知道了" or "关闭"
    for (const txt of ['我知道了', '不再提醒', '关闭', '跳过', '确定', 'OK', 'Got it']) {
      try {
        const b = page.locator(`button:has-text("${txt}")`).first();
        if (await b.count() > 0 && await b.isVisible({ timeout: 500 }).catch(() => false)) {
          await b.click({ force: true });
          console.log('[v4] Dismissed:', txt);
          await page.waitForTimeout(1000);
        }
      } catch {}
    }

    // Click login button AND wait for popup
    console.log('[v4] Clicking login...');
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 15000 }),
      page.locator('button:has-text("登录")').first().click({ force: true })
    ]);

    console.log('[v4] Terminal popup opened!');
    await popup.waitForTimeout(8000);

    // Focus terminal
    await popup.locator('body').click().catch(() => {});
    await popup.waitForTimeout(2000);

    // Execute commands
    for (let i = 0; i < cmds.length; i++) {
      const cmd = cmds[i];
      if (!cmd.startsWith('echo "') || !cmd.includes('/tmp/b64.')) {
        console.log(`[v4] [${i + 1}/${cmds.length}] ${cmd.slice(0, 80)}`);
      }

      await popup.keyboard.type(cmd, { delay: 5 });
      await popup.keyboard.press('Enter');

      // Smart wait
      if (cmd.includes('apt-get')) {
        await popup.waitForTimeout(30000);
      } else if (cmd.includes('npm install')) {
        await popup.waitForTimeout(60000);
      } else if (cmd.includes('nodejs')) {
        await popup.waitForTimeout(30000);
      } else if (cmd.includes('cat /tmp/b64')) {
        await popup.waitForTimeout(5000);
      } else {
        await popup.waitForTimeout(2000);
      }
    }

    console.log('[v4] All commands sent!');
    await popup.screenshot({ path: path.join(__dirname, 'v4-done.png') });
    await page.waitForTimeout(60000);

  } catch (err) {
    console.error('[v4] Error:', err.message);
    const pages = browser.contexts()[0]?.pages() || [];
    console.log('[v4] Open pages:', pages.map(p => p.url()));
    await page.screenshot({ path: path.join(__dirname, 'v4-error.png') });
    await page.waitForTimeout(10000);
  } finally {
    await browser.close();
    console.log('[v4] Done.');
  }
})();
