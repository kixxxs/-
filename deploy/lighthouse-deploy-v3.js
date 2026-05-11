// lighthouse-deploy-v3.js
// v3: Dismiss overlays/popups before clicking

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_IP = '42.194.230.53';
const LH_URL = 'https://console.cloud.tencent.com/lighthouse/instance';

const tarball = execSync(
  'tar czf - server.js server/database.js package.json',
  { cwd: path.join(__dirname, 'scp-payload'), maxBuffer: 10 * 1024 * 1024 }
);
const b64 = tarball.toString('base64');

// Split into chunks
const CHUNK_SIZE = 300;
const chunks = [];
for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
  chunks.push(b64.slice(i, i + CHUNK_SIZE));
}
console.log('[LH] Chunks:', chunks.length);

const deployLines = [];

// Env checks + setup
deployLines.push('echo "=== ENV CHECK ==="');
deployLines.push('which node && node -v || echo "NO_NODE"');
deployLines.push('which npm && npm -v || echo "NO_NPM"');
deployLines.push('which python3 || which python || echo "NO_PYTHON"');
deployLines.push('which make || echo "NO_MAKE"');
deployLines.push('which g++ || echo "NO_GPP"');
deployLines.push('echo "=== Installing build tools ==="');
deployLines.push('apt-get update -qq 2>&1 | tail -1');
deployLines.push('apt-get install -y -qq python3 make g++ 2>&1 | tail -3');
deployLines.push('echo "=== Checking Node.js ==="');
deployLines.push('which node || (curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs 2>&1 | tail -3)');
deployLines.push('node -v && npm -v');

// File transfer
deployLines.push('echo "=== Transferring files ==="');
deployLines.push('mkdir -p /app/server /app/data');
deployLines.push('rm -f /tmp/b64.*');
for (let i = 0; i < chunks.length; i++) {
  deployLines.push(`echo "${chunks[i]}" > /tmp/b64.${i}`);
}
deployLines.push('echo "=== Decoding ==="');
deployLines.push('cat /tmp/b64.* | tr -d "\\n" | base64 -d | tar xzf - -C /app && echo "EXTRACT_OK" || echo "EXTRACT_FAIL"');
deployLines.push('ls -la /app/');
deployLines.push('rm -f /tmp/b64.*');

// Install and start
deployLines.push('echo "=== npm install ==="');
deployLines.push('cd /app && npm install 2>&1 | tail -10');
deployLines.push('echo "=== Starting server ==="');
deployLines.push('pkill -f "node /app/server.js" 2>/dev/null; sleep 1');
deployLines.push('nohup env PORT=8080 DB_PATH=/app/data/artist_data.db node /app/server.js > /app/server.log 2>&1 &');
deployLines.push('sleep 3');
deployLines.push('ps aux | grep "node /app/server" | grep -v grep || (echo "FAILED:"; cat /app/server.log)');
deployLines.push('curl -s http://localhost:8080/api/ping && echo "API_OK" || echo "API_FAIL"');
deployLines.push('echo "=== COMPLETE ==="');

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1400,900']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  let termPage = null;
  const popupPromise = context.waitForEvent('page', { timeout: 30000 }).then(p => {
    termPage = p;
    console.log('[LH] Terminal popup captured');
  }).catch(() => {});

  try {
    console.log('[LH] Opening Lighthouse console...');
    await page.goto(LH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);

    if (page.url().includes('login')) {
      console.log('[LH] Login required...');
      await page.waitForURL('**/lighthouse/**', { timeout: 300000 }).catch(() => {});
      console.log('[LH] ✓ Logged in');
      await page.waitForTimeout(8000);
    }

    // ======= DISMISS OVERLAYS =======
    console.log('[LH] Checking for overlays...');

    // Try Escape key first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Try common close buttons for Tencent Cloud popups
    const closeSelectors = [
      '.tea-dialog__close',
      '.app-lighthouse-dialog__close',
      '[class*="close"]',
      'svg[class*="close"]',
      'button[aria-label="关闭"]',
      'button[aria-label="Close"]',
      '.app-lighthouse-overlay-close',
      '#tea-overlay-root .app-lighthouse-btn--icon',
      '[class*="overlay"] [class*="close"]',
    ];

    for (const sel of closeSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() > 0 && await el.isVisible({ timeout: 1000 }).catch(() => false)) {
          await el.click();
          console.log('[LH] Dismissed overlay:', sel);
          await page.waitForTimeout(1500);
          break;
        }
      } catch {}
    }

    // Try clicking "我知道了" or "不再提醒" buttons
    const dismissTexts = ['我知道了', '不再提醒', '关闭', '跳过', '确定'];
    for (const txt of dismissTexts) {
      try {
        const btn = page.locator(`button:has-text("${txt}"), span:has-text("${txt}")`).first();
        if (await btn.count() > 0 && await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click();
          console.log('[LH] Dismissed:', txt);
          await page.waitForTimeout(1500);
        }
      } catch {}
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // ======= CLICK LOGIN BUTTON =======
    console.log('[LH] Looking for login button...');

    // Try force-click (bypasses overlay interception)
    try {
      const loginBtn = page.locator('button:has-text("登录"), a:has-text("登录")').first();
      if (await loginBtn.count() > 0) {
        await loginBtn.dispatchEvent('click');
        console.log('[LH] ✓ Dispatched click event to login button');
        await page.waitForTimeout(5000);
      }
    } catch (e) {
      console.log('[LH] dispatchEvent failed:', e.message);
    }

    // Alternative: use JavaScript to click
    if (!termPage) {
      console.log('[LH] No popup yet, trying JS click...');
      try {
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const btn of btns) {
            if (btn.textContent?.trim() === '登录') {
              btn.click();
              return true;
            }
          }
          return false;
        });
        console.log('[LH] JS click executed');
        await page.waitForTimeout(5000);
      } catch {}
    }

    if (termPage) {
      console.log('[LH] Terminal ready! Executing commands...');
      await termPage.waitForTimeout(5000);

      await termPage.locator('body').click().catch(() => {});
      await termPage.waitForTimeout(1000);

      for (let i = 0; i < deployLines.length; i++) {
        const cmd = deployLines[i];
        const isChunk = cmd.startsWith('echo "') && cmd.includes('/tmp/b64.');

        if (!isChunk) {
          console.log(`[LH] [${i + 1}/${deployLines.length}] ${cmd.slice(0, 75)}`);
        } else if (i % 5 === 0) {
          console.log(`[LH] ...chunks progress...`);
        }

        await termPage.keyboard.type(cmd, { delay: 5 });
        await termPage.keyboard.press('Enter');

        if (cmd.includes('apt-get update')) {
          await termPage.waitForTimeout(20000);
        } else if (cmd.includes('apt-get install')) {
          await termPage.waitForTimeout(30000);
        } else if (cmd.includes('npm install')) {
          await termPage.waitForTimeout(60000);
        } else if (cmd.includes('nodejs')) {
          await termPage.waitForTimeout(30000);
        } else if (cmd.includes('cat /tmp/b64')) {
          await termPage.waitForTimeout(3000);
        } else {
          await termPage.waitForTimeout(cmd.length < 100 ? 1500 : 3000);
        }
      }

      console.log('[LH] All commands sent!');
      await termPage.screenshot({ path: path.join(__dirname, 'lh-final-v3.png') });
    } else {
      console.log('[LH] Could not open terminal. Screenshot saved.');
      await page.screenshot({ path: path.join(__dirname, 'lh-stuck-v3.png') });
    }

    await page.waitForTimeout(300000);

  } catch (err) {
    console.error('[LH] Error:', err.message);
  } finally {
    await browser.close();
    console.log('[LH] Done.');
  }
})();
