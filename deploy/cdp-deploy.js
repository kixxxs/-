// cdp-deploy.js — Uses Playwright persistent context with real Chrome profile
// Connects directly to OrcaTerm and pastes deployment commands

const { chromium } = require('playwright');
const path = require('path');
const { execSync } = require('child_process');

const USER_DATA = 'C:/Users/HLS/AppData/Local/Google/Chrome/User Data';

// Build deploy script inline
const tarball = execSync(
  'tar czf - server.js server/database.js package.json',
  { cwd: path.join(__dirname, 'scp-payload'), maxBuffer: 10 * 1024 * 1024 }
);
const b64 = tarball.toString('base64');
const CHUNK = 600;
const deployLines = [
  'echo "=== Setup ==="',
  'mkdir -p /app/server /app/data /tmp/b64chunks',
  'which node || (apt-get update -qq && apt-get install -y -qq curl && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs)',
  'apt-get install -y -qq python3 make g++ 2>&1 | tail -2',
  'node -v && npm -v',
  'echo "=== Writing chunks ==="',
  'rm -f /tmp/b64chunks/*',
];
for (let i = 0; i < b64.length; i += CHUNK) {
  deployLines.push(`echo "${b64.slice(i, i + CHUNK)}" > /tmp/b64chunks/${String(Math.floor(i / CHUNK)).padStart(3, '0')}`);
}
deployLines.push('echo "=== Decoding ==="');
deployLines.push('cat /tmp/b64chunks/* | tr -d "\\n" | base64 -d | tar xzf - -C /app && echo FILES_OK || echo FILES_FAIL');
deployLines.push('ls -la /app/');
deployLines.push('rm -rf /tmp/b64chunks');
console.log('[CDP] Deploy script:', deployLines.length, 'lines');

(async () => {
  // Kill existing Chrome first
  console.log('[CDP] Killing existing Chrome...');
  execSync('taskkill /f /im chrome.exe 2>nul', { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 3000));

  console.log('[CDP] Launching Chrome with your profile...');

  const context = await chromium.launchPersistentContext(USER_DATA, {
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1400,900', '--no-first-run'],
    viewport: null
  });

  // Check existing pages or open new one
  let pages = context.pages();
  console.log('[CDP] Existing pages:', pages.length);

  // Look for OrcaTerm page
  let termPage = pages.find(p => p.url().includes('orcaterm'));

  if (!termPage) {
    // Check if there's a Lighthouse page we can use
    let lhPage = pages.find(p => p.url().includes('lighthouse') || p.url().includes('cloud.tencent'));

    if (lhPage) {
      console.log('[CDP] Found Lighthouse page:', lhPage.url());
      // Click login button on the instance
      try {
        await lhPage.bringToFront();
        await lhPage.waitForTimeout(3000);

        // Find and click login
        const loginBtn = lhPage.locator('button:has-text("登录")').first();
        if (await loginBtn.count() > 0) {
          const [popup] = await Promise.all([
            lhPage.waitForEvent('popup', { timeout: 15000 }).catch(() => [null]),
            loginBtn.click({ force: true })
          ]);
          if (popup && popup !== null) {
            termPage = popup;
            console.log('[CDP] Terminal popup captured');
          }
        }
      } catch (e) {
        console.log('[CDP] Failed to click login:', e.message);
      }
    }
  }

  if (termPage) {
    console.log('[CDP] OrcaTerm page found!');
    await termPage.bringToFront();
    await termPage.waitForTimeout(5000);

    // Click to focus terminal
    await termPage.locator('body').click().catch(() => {});
    await termPage.waitForTimeout(1000);

    // Execute each line
    for (let i = 0; i < deployLines.length; i++) {
      const line = deployLines[i];
      const isChunk = line.includes('/tmp/b64chunks/');

      if (!isChunk) {
        console.log(`[CDP] [${i + 1}/${deployLines.length}] ${line.slice(0, 80)}`);
      } else if ((i - 8) % 3 === 0) {
        console.log(`[CDP] ...chunk progress...`);
      }

      // Type command
      await termPage.keyboard.type(line, { delay: 3 });
      await termPage.keyboard.press('Enter');

      // Wait based on command type
      if (line.includes('apt-get')) {
        await termPage.waitForTimeout(25000);
      } else if (line.includes('setup_22')) {
        await termPage.waitForTimeout(25000);
      } else if (line.includes('cat /tmp/b64chunks')) {
        await termPage.waitForTimeout(5000);
      } else if (line.includes('base64 -d')) {
        await termPage.waitForTimeout(5000);
      } else {
        await termPage.waitForTimeout(1500);
      }
    }

    console.log('[CDP] All commands executed!');

    // Now do npm install + start
    console.log('[CDP] Running npm install...');
    await termPage.keyboard.type('cd /app && npm install 2>&1 | tail -10', { delay: 5 });
    await termPage.keyboard.press('Enter');
    await termPage.waitForTimeout(60000);

    console.log('[CDP] Starting server...');
    await termPage.keyboard.type('pkill -f "node /app/server.js" 2>/dev/null; sleep 1; DB_PATH=/app/data/artist_data.db PORT=8080 nohup node /app/server.js > /app/server.log 2>&1 &', { delay: 5 });
    await termPage.keyboard.press('Enter');
    await termPage.waitForTimeout(5000);

    console.log('[CDP] Testing API...');
    await termPage.keyboard.type('sleep 2 && curl -s http://localhost:8080/api/ping && echo " API_OK!" || (echo "FAIL:"; cat /app/server.log)', { delay: 5 });
    await termPage.keyboard.press('Enter');
    await termPage.waitForTimeout(10000);

    await termPage.screenshot({ path: path.join(__dirname, 'cdp-result.png') });
    console.log('[CDP] Screenshot saved. Closing browser in 30s...');
    await termPage.waitForTimeout(30000);

  } else {
    console.log('[CDP] OrcaTerm not found. Opening new page...');
    const newPage = await context.newPage();
    await newPage.goto('https://console.cloud.tencent.com/lighthouse/instance', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    }).catch(() => {});
    console.log('[CDP] Opened Lighthouse. Please navigate to OrcaTerm and let me know.');
    await newPage.waitForTimeout(300000);
  }

  await context.close();
  console.log('[CDP] Done.');
})();
