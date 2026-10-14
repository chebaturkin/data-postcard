import { readFile } from 'node:fs/promises';

export async function checkProjects({ page, context, url, check }) {
  await page.goto(url);
  await page.locator('#reset-draft').click();
  check(await page.locator('#save-project').count() === 1, 'portable postcard saving is available');
  await page.locator('#tab-text').click();
  await page.locator('#title-input').fill('сохранённая открытка');
  await page.locator('#caption-input').fill('свой текст <без html>.');
  await page.locator('#tab-design').click();
  await page.locator('#theme-select').selectOption('archive');
  await page.locator('#size-select').selectOption('stories');
  await page.locator('#summary-select').selectOption('average');
  await page.locator('#order-select').selectOption('descending');
  await page.locator('#tab-data').click();
  await page.locator('#table-body tr').first().locator('input').nth(1).fill('66');
  await page.locator('#project-details summary').click();
  const pending = page.waitForEvent('download');
  await page.locator('#save-project').focus();
  await page.keyboard.press('Enter');
  const download = await pending;
  const buffer = await readFile(await download.path());
  const saved = JSON.parse(buffer.toString());
  check(download.suggestedFilename().endsWith('.postcard.json'), 'portable postcard filename is recognizable');
  check(saved.pendingTable.rows[0][1] === '66', 'project saving preserves unapplied table edits');
  const savedSvg = await page.evaluate(() => window.DataPostcard.state.svg);
  await page.locator('#reset-draft').click();
  await page.locator('#project-details summary').click();
  await page.locator('#project-input').setInputFiles({ name: 'saved.postcard.json', mimeType: 'application/json', buffer });
  await page.waitForFunction(() => document.querySelector('#project-status').textContent.includes('открытка открыта'));
  check(await page.evaluate(() => window.DataPostcard.state.svg) === savedSvg, 'opening restores the exact scene with data, text and design');
  check(await page.locator('#table-body tr').first().locator('input').nth(1).inputValue() === '66', 'opening restores editable raw values');
  await page.locator('#table-body tr').first().locator('input').nth(1).fill('ошибка');
  const rawDownload = page.waitForEvent('download');
  await page.locator('#save-project').click();
  const rawSaved = JSON.parse(await readFile(await (await rawDownload).path(), 'utf8'));
  check(rawSaved.pendingTable.rows[0][1] === 'ошибка', 'portable draft saves invalid pending cells without losing valid scene');
  await page.reload();
  check(await page.locator('#title-input').inputValue() === 'сохранённая открытка', 'opened postcard becomes the local draft');
  await page.locator('#project-details summary').click();
  const before = await page.evaluate(() => localStorage.getItem('data-postcard-draft-v1'));
  for (const [name, body] of [['broken.json', '{broken'], ['data.json', '[{"name":"a","value":1},{"name":"b","value":2}]'], ['large.json', ' '.repeat(1024 * 1024 + 1)]]) {
    await page.locator('#project-input').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(body) });
    await page.waitForFunction(() => document.querySelector('#project-status').dataset.level === 'error');
    check(await page.evaluate(() => window.DataPostcard.state.svg) === savedSvg, `${name} preserves the current postcard`);
    check(await page.evaluate(() => localStorage.getItem('data-postcard-draft-v1')) === before, `${name} preserves the saved draft`);
    check(!(await page.locator('#project-status').textContent()).includes('<script>'), `${name} has a plain correction message`);
  }
  // A slow file must not overwrite changes made while it is being read.
  await page.evaluate(() => {
    window.originalFileText = File.prototype.text;
    File.prototype.text = function () { return new Promise(resolve => { window.releaseProjectRead = () => window.originalFileText.call(this).then(resolve); }); };
  });
  await page.locator('#project-input').setInputFiles({ name: 'slow.json', mimeType: 'application/json', buffer });
  check(await page.locator('#open-project').getAttribute('aria-busy') === 'true', 'project reading exposes a loading state');
  await page.locator('#table-body tr').first().locator('input').nth(1).fill('77');
  await page.evaluate(async () => { await window.releaseProjectRead(); File.prototype.text = window.originalFileText; });
  await page.waitForTimeout(100);
  check(await page.locator('#table-body tr').first().locator('input').nth(1).inputValue() === '77', 'late project reading cannot overwrite new edits');
  check(await page.locator('#open-project').getAttribute('aria-busy') === 'false', 'cancelled reading clears its loading state');
  await page.locator('#apply-table').click();

  const noStorage = await context.browser().newContext();
  await noStorage.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error('storage unavailable'); };
  });
  const privatePage = await noStorage.newPage();
  try {
    await privatePage.goto(url);
    check((await privatePage.locator('#draft-status').textContent()).includes('не смог сохранить'), 'blocked browser storage has a clear status');
    await privatePage.locator('#project-details summary').click();
    const offlineDownload = privatePage.waitForEvent('download');
    await privatePage.locator('#save-project').click();
    check((await offlineDownload).suggestedFilename().endsWith('.postcard.json'), 'file saving works when local storage is unavailable');
    await privatePage.locator('#project-input').setInputFiles({ name: 'saved.json', mimeType: 'application/json', buffer });
    await privatePage.waitForFunction(() => document.querySelector('#project-status').textContent.includes('открытка открыта'));
    check(await privatePage.locator('#title-input').inputValue() === 'сохранённая открытка', 'file opening works when local storage is unavailable');
  } finally { await noStorage.close(); }

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `project controls fit at ${width}px`);
  }
  await page.locator('#reset-draft').click();
}
