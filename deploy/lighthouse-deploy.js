// deploy/lighthouse-deploy.js
// Uses Playwright to automate Tencent Cloud Lighthouse console deployment
// The Lighthouse "一键登录" (One-click Login) opens a web terminal directly

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_IP = '42.194.230.53';
const LH_URL = 'https://console.cloud.tencent.com/lighthouse/instance';

// Build deployment tarball (base64)
const tarball = execSync(
  'tar czf - server.js server/database.js package.json',
  { cwd: path.join(__dirname, 'scp-payload'), maxBuffer: 10 * 1024 * 1024 }
);
const b64 = tarball.toString('base64');
console.log('[LH] Tarball:', tarball.length, 'bytes, base64:', b64.length, 'chars');

// Deployment commands — split into manageable chunks
const deployLines = [
  'echo "=== DEPLOY START ==="',
  'mkdir -p /app/server /app/data',
  `echo "${b64}" | base64 -d | tar xzf - -C /app`,
  'ls -la /app/',
  'cd /app && npm install 2>&1',
  'pkill -f "node /app/server.js" 2>/dev/null; sleep 1',
  'nohup env PORT=8080 DB_PATH=/app/data/artist_data.db node /app/server.js > /app/server.log 2>&1 &',
  'sleep 2',
  'ps aux | grep "node /app/server" | grep -v grep || cat /app/server.log',
  'curl -s http://localhost:8080/api/ping',
  'echo "=== DEPLOY DONE ==="',
];

// Save for manual use
fs.writeFileSync(path.join(__dirname, 'lh-deploy.sh'), deployLines.join('\n'));
console.log('[LH] Manual deploy script saved to deploy/lh-deploy.sh');

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1400,900']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Track popups (web terminal opens in new window)
  let termPage = null;
  context.on('page', p => {
    console.log('[LH] Popup detected:', p.url());
    termPage = p;
  });

  try {
    // Navigate to Lighthouse console
    console.log('[LH] Opening Lighthouse console...');
    await page.goto(LH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);

    let url = page.url();
    console.log('[LH] URL:', url);

    // Handle login
    if (url.includes('login')) {
      console.log('[LH] Please log in to Tencent Cloud in the browser...');
      try {
        await page.waitForURL('**/lighthouse/**', { timeout: 300000 });
        console.log('[LH] ✓ Logged in');
        await page.waitForTimeout(5000);
      } catch {
        console.log('[LH] Login timeout. URL:', page.url());
      }
    }

    await page.screenshot({ path: path.join(__dirname, 'lh-console.png') });
    console.log('[LH] Screenshot saved');

    // Find and click the "登录" button on the instance row
    console.log('[LH] Looking for instance login button...');

    // Try to locate the instance row by IP
    const pageText = await page.locator('body').innerText().catch(() => '');
    console.log('[LH] Page has IP:', pageText.includes(SERVER_IP));

    // Click login button
    const loginBtns = page.locator('a:has-text("登录"), button:has-text("登录"), span:has-text("登录")');
    console.log('[LH] Login buttons found:', await loginBtns.count());

    for (let i = 0; i < await loginBtns.count(); i++) {
      const btn = loginBtns.nth(i);
      const txt = await btn.textContent().catch(() => '');
      console.log('[LH]   Button', i, ':', txt?.trim());
      if (txt?.trim() === '登录') {
        await btn.click();
        console.log('[LH] ✓ Clicked login button', i);
        break;
      }
    }

    await page.waitForTimeout(5000);

    // Check if terminal popped up
    if (termPage) {
      console.log('[LH] Terminal window found!');
      await termPage.waitForTimeout(8000);
      await termPage.screenshot({ path: path.join(__dirname, 'lh-terminal.png') });
      console.log('[LH] Terminal screenshot saved');

      // Wait for terminal to be ready
      await termPage.waitForTimeout(3000);

      // Click on terminal to focus
      const body = termPage.locator('body');
      await body.click().catch(() => {});
      await termPage.waitForTimeout(1000);

      // Type deployment commands one by one
      for (let i = 0; i < deployLines.length; i++) {
        const cmd = deployLines[i];
        console.log('[LH] Running:', cmd.slice(0, 80) + (cmd.length > 80 ? '...' : ''));

        if (cmd.length < 500) {
          // Short command — type directly
          await termPage.keyboard.type(cmd, { delay: 10 });
          await termPage.keyboard.press('Enter');
          await termPage.waitForTimeout(2000);
        } else {
          // Long command (base64) — type in chunks
          const chunkSize = 200;
          for (let j = 0; j < cmd.length; j += chunkSize) {
            const chunk = cmd.slice(j, j + chunkSize);
            await termPage.keyboard.type(chunk, { delay: 0 });
            // Small pause between chunks to let terminal buffer
            if (j % 1000 === 0) await termPage.waitForTimeout(500);
          }
          await termPage.keyboard.press('Enter');
          console.log('[LH] Long command sent, waiting...');
          await termPage.waitForTimeout(10000);
        }
      }

      console.log('[LH] All commands sent!');
      await termPage.waitForTimeout(5000);
      await termPage.screenshot({ path: path.join(__dirname, 'lh-done.png') });
    } else {
      console.log('[LH] No terminal popup. Lighthouse may use a different UI.');
      console.log('[LH] Current page URL:', page.url());
      await page.screenshot({ path: path.join(__dirname, 'lh-nopopup.png') });

      // Try clicking on the instance to go to detail page
      console.log('[LH] Trying to navigate to instance detail...');
      const instanceLink = page.locator(`text="${SERVER_IP}"`).first();
      if (await instanceLink.count() > 0) {
        await instanceLink.click();
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(__dirname, 'lh-detail.png') });
        console.log('[LH] Detail page screenshot saved');
      }
    }

    console.log('[LH] Waiting 3 minutes — close browser when done...');
    await page.waitForTimeout(180000);

  } catch (err) {
    console.error('[LH] Error:', err.message);
    await page.screenshot({ path: path.join(__dirname, 'lh-error.png') });
  } finally {
    await browser.close();
    console.log('[LH] Done.');
  }
})();
