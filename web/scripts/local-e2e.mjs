import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, unlink } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const webDir = process.cwd();
const screenshotDir = process.env.AROVAQ_E2E_SCREENSHOT_DIR;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
async function capture(page, name) {
  if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/${name}.png`, fullPage: true });
}
async function captureMobile(page, name) {
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error(`Mobile layout overflows at ${name}.`);
  await capture(page, `mobile-${name}`);
  await page.setViewportSize({ width: 1440, height: 1000 });
}
const demo = spawn('node', ['scripts/local-demo.mjs'], { cwd: webDir, stdio: ['ignore', 'pipe', 'inherit'] });
let demoOutput = '';
const demoReady = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Local chain did not start. ${demoOutput}`)), 30_000);
  demo.stdout.on('data', chunk => {
    demoOutput += chunk.toString();
    if (demoOutput.includes('LOCAL / DEMO CHAIN READY')) { clearTimeout(timeout); resolve(); }
  });
  demo.once('exit', code => { if (!demoOutput.includes('LOCAL / DEMO CHAIN READY')) reject(new Error(`Local demo exited (${code}). ${demoOutput}`)); });
});
let vite;
let browser;
try {
  await demoReady;
  vite = spawn('npm', ['run', 'dev', '--', '--port', '4178', '--strictPort'], { cwd: webDir, stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    try { ready = (await fetch('http://127.0.0.1:4178')).ok; } catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  if (!ready) throw new Error('Vite did not start for browser E2E.');
  const executablePath = process.env.CHROME_PATH || '/home/web-ghost/.local/bin/google-chrome';
  browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  await page.addInitScript(() => {
    const rpc = 'http://127.0.0.1:8545';
    let accountIndex = 0;
    const call = async (method, params = []) => {
      const response = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const result = await response.json();
      if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code, data: result.error.data });
      return result.result;
    };
    const provider = {
      request: async ({ method, params = [] }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [(await call('eth_accounts'))[accountIndex]];
        if (method === 'eth_chainId' && window.__forceWrongArovaqNetwork) return '0x1';
        if (method === 'wallet_switchEthereumChain') return null;
        return call(method, params);
      },
      on: () => provider,
      removeListener: () => provider,
    };
    Object.defineProperty(window, 'ethereum', { value: provider, configurable: true });
    Object.defineProperty(window, '__switchArovaqDemoAccount', { value: (index) => { accountIndex = index; } });
  });
  await page.goto('http://127.0.0.1:4178');
  await page.keyboard.press('Tab');
  const focusStyle = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  if (focusStyle !== 'solid') throw new Error('Keyboard focus indicator is not visible.');
  await page.evaluate(() => document.activeElement.blur());
  if (!(await page.locator('h1').innerText()).includes('COMPETITION')) throw new Error('Editorial competition landing did not render.');
  await capture(page, 'wallet-disconnected-landing');
  await captureMobile(page, 'landing');
  await page.getByRole('button', { name: 'CONNECT WALLET', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  if (!(await page.locator('.page-title h1').innerText()).includes('CONDITION')) throw new Error('Competition specification screen did not render.');
  await capture(page, 'create-specification');
  await captureMobile(page, 'create-specification');
  await page.getByRole('button', { name: /CREATE & FUND CHALLENGE/ }).click();
  await page.getByText(/Create challenge: confirmed/).waitFor({ timeout: 20_000 });
  await page.getByRole('button', { name: /EVENT \/ 01/ }).click();
  await page.getByText('ENTER THE WORLD').waitFor();
  await capture(page, 'competition-detail-registration');
  await captureMobile(page, 'competition-detail-registration');

  await page.getByLabel('CHAINMMO CHARACTER ID').fill('42');
  await page.getByRole('button', { name: /CHECK OWNERSHIP/ }).click();
  await page.getByText('This character is not controlled by the connected wallet.').waitFor();
  await capture(page, 'participant-binding-error');

  await page.evaluate(() => window.__switchArovaqDemoAccount(1));
  const connectedButton = page.locator('.wallet-control.connected');
  await connectedButton.click();
  await page.getByRole('button', { name: 'CONNECT WALLET', exact: true }).click();
  await page.getByRole('button', { name: /CHECK OWNERSHIP/ }).click();
  await page.getByText(/CANONICAL OWNER/).waitFor();
  await capture(page, 'character-owner-verified');
  await page.getByRole('button', { name: /REGISTER CHARACTER/ }).click();
  await page.getByText(/Register character: confirmed/).waitFor({ timeout: 20_000 });
  await page.getByText('CANONICALLY BOUND ✓').waitFor();
  await page.getByText('BASELINE CAPTURED').waitFor();
  await page.getByText('KEEP PLAYING').waitFor();
  await capture(page, 'baseline-and-below-target');
  await captureMobile(page, 'baseline-and-below-target');
  await page.getByRole('button', { name: /DEMO: PROGRESS CHARACTER/ }).click();
  await page.getByText(/Demo progression: confirmed/).waitFor({ timeout: 20_000 });
  await page.getByText(/OBJECTIVE\s*REACHED/).waitFor();
  await capture(page, 'objective-reached');
  await captureMobile(page, 'objective-reached');
  await page.getByRole('button', { name: /CLAIM 1 MON/ }).click();
  await capture(page, 'claim-pending');
  await page.getByText(/Claim reward: confirmed/).waitFor({ timeout: 20_000 });
  await page.getByText('OBJECTIVE VERIFIED').waitFor();
  await page.getByText('REWARD CLAIMED').waitFor();
  await capture(page, 'claim-success');
  await captureMobile(page, 'claim-success');
  await page.locator('.wallet-control.connected').click();
  await page.evaluate(() => { window.__forceWrongArovaqNetwork = true; });
  await page.getByRole('button', { name: 'CONNECT WALLET', exact: true }).click();
  await page.getByText('Wallet network does not match LOCAL / DEMO.').waitFor();
  await capture(page, 'wallet-wrong-network');
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error('Mobile layout overflows the 390px viewport.');
  if (browserErrors.length) throw new Error(`Browser console errors: ${browserErrors.join(' | ')}`);
  console.log('BROWSER E2E PASS: create/fund → owner check → register/baseline → canonical fixture progression → claim; 390px mobile viewport has no horizontal overflow.');
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  vite?.kill('SIGTERM');
  demo.kill('SIGTERM');
  await once(demo, 'exit').catch(() => {});
  await unlink(`${webDir}/.env.local`).catch(() => {});
}
