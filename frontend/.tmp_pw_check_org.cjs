const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(`console:${msg.type()}:${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`pageerror:${err.message}`));

  await page.goto('http://127.0.0.1:4175', { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('input[placeholder="用户名"]', 'admin-pico');
  await page.fill('input[placeholder="密码"]', 'pico@2026');
  await page.click('button:has-text("登 录")');
  await page.waitForTimeout(3000);

  const text = await page.locator('body').innerText();
  console.log('has_org_tree', text.includes('组织架构树'));
  console.log('has_user_list', text.includes('员工列表'));
  console.log('is_blank', text.trim().length === 0);
  if (logs.length) {
    console.log(logs.join('\n'));
  }

  await browser.close();
})().catch((err) => {
  console.error('playwright_err', err.message);
  process.exitCode = 1;
});
