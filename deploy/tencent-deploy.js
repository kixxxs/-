// deploy/tencent-deploy.js
// Step 1: Open Tencent Cloud console, navigate to web terminal, add SSH public key
// Step 2: After SSH key is added, scp files and deploy via SSH

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CVM_IP = '42.194.230.53';
const CONSOLE_URL = 'https://console.cloud.tencent.com/cvm/instance';

// Read the SSH public key
const pubKey = fs.readFileSync(path.join(os.homedir(), '.ssh', 'id_rsa.pub'), 'utf-8').trim();
const sshKeyCmd = `mkdir -p ~/.ssh && echo "${pubKey}" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys && echo SSH_KEY_ADDED`;

console.log('[Deploy] SSH public key ready.');
console.log('[Deploy] Key length:', pubKey.length, 'chars');
console.log('[Deploy] ————————————————————————');
console.log('[Deploy] I will now open Chrome to the Tencent Cloud console.');
console.log('[Deploy] If needed, please log in. Then I will try to automate the terminal.');
console.log('[Deploy] ————————————————————————');

// Save SSH key command for manual fallback
fs.writeFileSync(path.join(__dirname, 'ssh-key-setup.sh'), sshKeyCmd);

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1400,900']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Track popup for OrcaTerm
  let terminalPage = null;
  const popupPromise = context.waitForEvent('page', { timeout: 120000 }).then(p => {
    terminalPage = p;
    console.log('[Deploy] Terminal window captured!');
    return p;
  }).catch(() => {
    console.log('[Deploy] No popup detected within 2 minutes.');
  });

  try {
    // Navigate to CVM console
    console.log('[Deploy] Opening CVM console...');
    await page.goto(CONSOLE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);

    let url = page.url();
    console.log('[Deploy] Page URL:', url);

    // Handle login
    if (url.includes('login') || url.includes('passport')) {
      console.log('[Deploy] Login required. Please log in the browser window.');
      try {
        await page.waitForURL('**/cvm/instance**', { timeout: 300000 });
        console.log('[Deploy] ✓ Logged in!');
        await page.waitForTimeout(5000);
      } catch {
        console.log('[Deploy] Login timed out. Current URL:', page.url());
      }
    }

    // Save screenshot
    await page.screenshot({ path: path.join(__dirname, 'console.png') });
    console.log('[Deploy] Console screenshot saved (deploy/console.png)');

    // Try clicking the instance's Log In button
    console.log('[Deploy] Looking for login button...');

    // Print all visible buttons for debugging
    const pageText = await page.locator('body').innerText().catch(() => '');
    const hasInstance = pageText.includes(CVM_IP);
    console.log('[Deploy] Page contains IP', CVM_IP, ':', hasInstance);

    // Try to click the login action
    // Tencent Cloud console: each instance row has an "操作" column with "登录" link
    let clicked = false;

    // Method 1: Find by link text
    const loginLinks = page.locator('a:has-text("登录"), button:has-text("登录"), span[title="登录"], a[title="登录"]');
    const linkCount = await loginLinks.count();
    console.log('[Deploy] Found', linkCount, 'login elements');

    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      try {
        const link = loginLinks.nth(i);
        const text = await link.textContent().catch(() => '');
        console.log('[Deploy]   Login element', i, ':', text?.trim());
      } catch {}
    }

    if (linkCount > 0) {
      try {
        await loginLinks.first().click();
        console.log('[Deploy] ✓ Clicked first login link');
        clicked = true;
      } catch (e) {
        console.log('[Deploy] Click failed:', e.message);
      }
    }

    // Method 2: Try the "操作" column approach
    if (!clicked) {
      console.log('[Deploy] Trying alternative: find by row...');
      // Look for table row containing our IP, then find login in that row
      const rows = page.locator('tr');
      const rowCount = await rows.count();
      for (let i = 0; i < Math.min(rowCount, 20); i++) {
        try {
          const rowText = await rows.nth(i).innerText();
          if (rowText.includes(CVM_IP)) {
            console.log('[Deploy] Found row with IP at index', i);
            const loginInRow = rows.nth(i).locator('a:has-text("登录"), button:has-text("登录")');
            if (await loginInRow.count() > 0) {
              await loginInRow.first().click();
              console.log('[Deploy] ✓ Clicked login in row');
              clicked = true;
              break;
            }
          }
        } catch {}
      }
    }

    // Wait for popup
    await page.waitForTimeout(3000);

    if (terminalPage) {
      console.log('[Deploy] Terminal window found!');
      await terminalPage.waitForTimeout(8000);

      // Screenshot terminal
      await terminalPage.screenshot({ path: path.join(__dirname, 'terminal.png') });
      console.log('[Deploy] Terminal screenshot saved');

      // Try to interact with terminal
      // OrcaTerm uses iframe, so get the iframe first
      let frame = terminalPage.mainFrame();
      const iframes = terminalPage.frames();
      console.log('[Deploy] Frames in terminal:', iframes.length);

      // The terminal iframe is usually the webssh iframe
      for (const f of iframes) {
        if (f !== frame) {
          console.log('[Deploy] Child frame URL:', f.url());
          frame = f; // Use the child frame (where xterm.js lives)
        }
      }

      // Click on the terminal to focus
      await frame.click('body').catch(() => {});
      await terminalPage.waitForTimeout(1000);

      // Type SSH key command
      console.log('[Deploy] Typing SSH key setup command...');
      await terminalPage.keyboard.type(sshKeyCmd, { delay: 20 });
      await terminalPage.waitForTimeout(500);
      await terminalPage.keyboard.press('Enter');
      console.log('[Deploy] ✓ SSH key command sent!');

      // Wait for output
      await terminalPage.waitForTimeout(3000);
      await terminalPage.screenshot({ path: path.join(__dirname, 'terminal-after.png') });
      console.log('[Deploy] Terminal after-command screenshot saved');

    } else {
      console.log('[Deploy] No terminal window detected.');
      console.log('[Deploy] ————————————————————————');
      console.log('[Deploy] Please manually open the web terminal and run:');
      console.log('[Deploy]   (content saved in deploy/ssh-key-setup.sh)');
      console.log('[Deploy]');
      console.log('[Deploy] After SSH key is added, the rest is automated.');
      console.log('[Deploy] ————————————————————————');
    }

    // Wait to let user see results
    console.log('[Deploy] Waiting 3 minutes then proceeding with SCP...');
    await page.waitForTimeout(180000);

  } catch (err) {
    console.error('[Deploy] Error:', err.message);
  } finally {
    await browser.close();
    console.log('[Deploy] Browser closed.');
  }

  // Step 2: Try SCP transfer now that SSH key should be in place
  console.log('[Deploy] ————————————————————————');
  console.log('[Deploy] Attempting SCP file transfer...');

  try {
    const scpResult = execSync(
      `scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 server.js server/database.js root@${CVM_IP}:/app/`,
      { cwd: path.join(__dirname, '..'), timeout: 30000, encoding: 'utf-8' }
    );
    console.log('[Deploy] SCP success:', scpResult);
  } catch (e) {
    console.log('[Deploy] SCP failed (SSH key may not be set up yet):', e.message);
    console.log('[Deploy] Please manually add SSH key first, then run:');
    console.log('[Deploy]   node deploy/scp-deploy.js');
  }
})();
