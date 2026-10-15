import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { checkMotion } from './motion-browser.mjs';
import { checkDesk } from './desk-browser.mjs';
import { checkProjects } from './project-browser.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
let url = process.env.TEST_URL;
let server;
const screenshots = process.argv.includes('--screenshots');
const errors = [];
let browser;
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };
try {
  if (!url) {
    const serverScript = `
from http.server import SimpleHTTPRequestHandler, test
from urllib.parse import urlsplit, urlunsplit

class ProjectHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        parts = urlsplit(path)
        prefix = '/data-postcard'
        if parts.path == prefix or parts.path.startswith(prefix + '/'):
            path = urlunsplit(parts._replace(path=parts.path[len(prefix):] or '/'))
        return super().translate_path(path)

test(HandlerClass=ProjectHandler, port=0, bind='127.0.0.1')
`;
    server = spawn('python3', ['-u', '-c', serverScript], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    url = await new Promise((resolve, reject) => {
      let output = '';
      let stderr = '';
      const timeout = setTimeout(() => reject(new Error('static test server did not start')), 5000);
      server.stderr.on('data', chunk => { stderr += chunk; });
      server.stdout.on('data', chunk => { output += chunk; const port = output.match(/port (\d+)/)?.[1]; if (port) { clearTimeout(timeout); resolve(`http://127.0.0.1:${port}`); } });
      server.once('error', error => { clearTimeout(timeout); reject(error); });
      server.once('exit', code => { clearTimeout(timeout); if (!output.match(/port (\d+)/)) reject(new Error(`static server exited ${code}: ${stderr}`)); });
    });
  }
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(url)).ok) break; } catch {} await delay(50); }
  browser = await chromium.launch({ args: ['--disable-gpu'] });
  const context = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  check((await page.title()).startsWith('data postcard'), 'lowercase page title');
  check(await page.locator('#table-body tr').count() === 7, 'reading table ready');
  check(await page.locator('#sample-select').count() === 1, 'examples are available in the data editor');
  await page.locator('#table-body tr').first().locator('input').nth(1).fill('99');
  check((await page.locator('#draft-status').textContent()).includes('ещё не применены'), 'unapplied table edits are not reported as saved');
  const latestDownload = page.waitForEvent('download');
  await page.locator('#export-svg').click();
  const latestSvg = await readFile(await (await latestDownload).path(), 'utf8');
  check(latestSvg.includes('405 мин'), 'download applies the latest table values');
  await page.locator('#apply-table').click();
  check((await page.locator('#postcard-preview').textContent()).includes('405 мин'), 'table edits update the total');
  const previous = await page.locator('#postcard-preview').innerHTML();
  await page.locator('#table-body tr').first().locator('input').nth(1).fill('oops');
  await page.locator('#apply-table').click();
  check(await page.locator('#data-errors').isVisible(), 'invalid cells show an error');
  check(await page.locator('#postcard-preview').innerHTML() === previous, 'invalid edits preserve the preview');
  check(await page.locator('#table-body tr').first().locator('input').nth(1).getAttribute('aria-invalid') === 'true', 'invalid value is marked in its cell');
  check(await page.locator('#table-body tr').first().locator('input').nth(1).evaluate(input => input === document.activeElement), 'first invalid cell receives keyboard focus');
  check((await page.locator('#data-errors').textContent()).startsWith('строка 1,'), 'table errors use visible data-row numbers');
  const blockedDownloads = [];
  const recordBlockedDownload = download => blockedDownloads.push(download);
  page.on('download', recordBlockedDownload);
  await page.locator('#tab-text').click();
  await page.locator('#export-html').click();
  check((await page.locator('#render-status').textContent()).includes('проверьте таблицу'), 'invalid table stops export with a correction');
  check(await page.locator('#tab-data').getAttribute('aria-selected') === 'true', 'blocked export opens the data correction panel');
  await page.waitForTimeout(100);
  check(blockedDownloads.length === 0, 'invalid edits cannot download a stale postcard');
  page.off('download', recordBlockedDownload);
  await page.locator('#table-body tr').first().locator('input').nth(1).fill('99');
  check(await page.locator('#table-body tr').first().locator('input').nth(1).getAttribute('aria-invalid') === null, 'editing clears the old cell marker');
  await page.locator('#apply-table').click();
  check(await page.locator('#data-table [aria-invalid="true"]').count() === 0, 'valid table clears all cell markers');
  await page.locator('#reset-draft').click();
  await page.locator('#tab-text').click();
  await page.locator('#title-input').fill('итоги <недели>');
  await page.locator('#caption-input').fill('свой контекст для графика.');
  await page.locator('#tab-design').click();
  await page.locator('#summary-select').selectOption('average');
  await page.locator('#theme-select').selectOption('archive');
  await page.locator('#size-select').selectOption('stories');
  await page.reload();
  check(await page.locator('#title-input').inputValue() === 'итоги <недели>', 'draft restores text safely');
  check(await page.locator('#size-select').inputValue() === 'stories', 'draft restores format');
  check(await page.locator('#summary-select').inputValue() === 'average', 'draft restores summary');
  await page.locator('#tab-design').click();
  await page.locator('#summary-select').selectOption('none');
  check(!(await page.locator('#postcard-preview').textContent()).includes('в среднем'), 'summary can be hidden');
  await page.locator('[name=\"graph-mode\"][value=\"' + 'calendar' + '\"]').check();
  check((await page.locator('#graph-error').textContent()).includes('нужна колонка с датой'), 'missing dates have a correction');
  await page.locator('#tab-data').click();
  await page.locator('#import-details summary').click();
  await page.locator('#paste-input').fill('категория\tсумма\nеда\t1200\nтранспорт\t600');
  await page.locator('#paste-button').click();
  check(await page.locator('#table-body tr').count() === 2, 'two-row spreadsheet paste works');
  check(await page.locator('.delete-row').first().isDisabled(), 'minimum row limit stays visible');
  const pasted = await page.locator('#postcard-preview').innerHTML();
  await page.locator('#paste-input').fill('категория,сумма\nеда,3');
  await page.locator('#paste-button').click();
  check(await page.locator('#postcard-preview').innerHTML() === pasted, 'short import preserves existing result');
  await page.locator('#file-input').setInputFiles({ name: 'notes.csv', mimeType: 'text/csv', buffer: Buffer.from('категория;сумма\n"еда; кофе";12,5\nтранспорт;8,2') });
  check(await page.locator('#table-body tr').count() === 2, 'semicolon csv file import works');
  check((await page.locator('#postcard-preview').textContent()).includes('20,7'), 'decimal commas survive import');
  const imported = await page.locator('#postcard-preview').innerHTML();
  await page.locator('#file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('unsupported') });
  check(await page.locator('#postcard-preview').innerHTML() === imported, 'unsupported file preserves preview');
  await page.locator('#file-input').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('[{"дата":"2026-10-01","значение":3},{"дата":"2026-10-02","значение":4}]') });
  check(await page.locator('#mode-select').inputValue() === 'timeline', 'dated json chooses a line');
  await page.locator('#tab-design').click();

  await page.locator('#date-select').selectOption('');
  check(await page.locator('#date-select').inputValue() === '', 'unused date selection remains unused');
  check((await page.locator('#graph-error').textContent()).includes('нужна колонка с датой'), 'unused date selection also clears the chart');
  await page.locator('#date-select').selectOption('дата');
  for (const mode of ['bars', 'dots', 'timeline', 'calendar']) {
    await page.locator('[name=\"graph-mode\"][value=\"' + mode + '\"]').check();
    check(!/NaN|undefined|нужна колонка|нет числовых/.test((await page.locator('#postcard-preview text, #postcard-preview title, #postcard-preview desc').allTextContents()).join('')), `${mode} renders dated data`);
  }
  for (const theme of ['paper', 'archive', 'court', 'night', 'ink']) {
    await page.locator('#theme-select').selectOption(theme);
    check(await page.locator('#postcard-paper').getAttribute('data-theme') === theme, `${theme} theme renders`);
  }
  await page.locator('#tab-data').click();
  await page.locator('#reset-draft').click();
  await page.locator('#add-row').click();
  check(await page.locator('#table-body tr').count() === 8, 'add row works');
  await page.locator('.delete-row').last().click();
  check(await page.locator('#table-body tr').count() === 7, 'delete row works');
  await page.locator('#tab-data').focus();
  await page.keyboard.press('ArrowRight');
  check(await page.locator('#tab-text').getAttribute('aria-selected') === 'true', 'tabs work with arrow keys');
  await page.locator('#reset-draft').click();
  await page.locator('#table-head input').nth(1).fill('день');
  await page.locator('#apply-table').click();
  check((await page.locator('#data-errors').textContent()).includes('дублирующееся'), 'duplicate table headers report errors');
  check(await page.locator('#table-head input').nth(1).getAttribute('aria-invalid') === 'true', 'duplicate header is marked in the header field');
  await page.locator('#reset-draft').click();

  for (const format of ['svg', 'png', 'html']) {
    const downloaded = page.waitForEvent('download');
    await page.locator('#export-' + format).click();
    const download = await downloaded;
    const path = await download.path();
    const buffer = await readFile(path);
    check(download.suggestedFilename().endsWith('.' + format), `${format} downloads`);
    if (format === 'png') {
      check(buffer.readUInt32BE(16) === 1200 && buffer.readUInt32BE(20) === 900, 'png has the requested dimensions');
      if (screenshots) { await mkdir(new URL('../docs/images/', import.meta.url), { recursive: true }); await writeFile(new URL('../docs/images/reading.png', import.meta.url), buffer); }
    } else if (format === 'html') {
      check(!/https?:\/\//.test(buffer.toString().replace('http://www.w3.org/2000/svg', '')), 'html export needs no remote assets');
      const standalone = await context.newPage();
      await standalone.setContent(buffer.toString());
      check(await standalone.locator('svg').count() === 1, 'standalone html renders a postcard');
      await standalone.close();
    } else check(buffer.toString().includes('неделя чтения'), 'svg contains the selected title');
  }
  await page.locator('#tab-design').click();
  await page.locator('#size-select').selectOption('stories');
  const verticalDownload = page.waitForEvent('download');
  await page.locator('#export-png').click();
  const vertical = await readFile(await (await verticalDownload).path());
  check(vertical.readUInt32BE(16) === 1080 && vertical.readUInt32BE(20) === 1920, 'stories export has portrait dimensions');
  await page.locator('#reset-draft').click();

  if (screenshots) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.screenshot({ path: root + 'docs/images/editor.png', fullPage: true, animations: 'disabled' });
    for (const sample of ['expenses', 'content']) {
      await page.locator('#sample-select').selectOption(sample);
      const pending = page.waitForEvent('download');
      await page.locator('#export-png').click();
      await (await pending).saveAs(root + `docs/images/${sample}.png`);
    }
    await page.locator('#reset-draft').click();
  }
  for (const sample of ['weather', 'sport']) {
    await page.locator('#sample-select').selectOption(sample);
    check(await page.locator('#table-body tr').count() === 7, `${sample} sample available`);
  }
  await page.locator('#reset-draft').click();
  await page.evaluate(() => localStorage.setItem('data-postcard-draft-v1', '{broken'));
  await page.reload();
  check(await page.locator('#table-body tr').count() === 7, 'corrupt storage falls back to a usable example');
  if (screenshots) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  }
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no page overflow at ${width}px`);
    await page.locator('#tab-design').click();
    await page.locator('#size-select').selectOption('stories');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `portrait view fits at ${width}px`);
    await page.locator('#size-select').selectOption('landscape');
    await page.locator('#tab-data').click();
    if (screenshots && width === 390) { await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); }); await page.screenshot({ path: root + 'docs/images/mobile.png', fullPage: true, animations: 'disabled' }); }
  }
  await checkDesk({ page, url, check });
  await checkProjects({ page, context, url, check });
  await checkMotion({ page, context, url, root, check });
  await page.goto(url + '/404.html');
  check(await page.getByRole('link', { name: 'открыть редактор' }).count() === 1, '404 offers a route back');
  check(errors.length === 0, 'no browser console or page errors: ' + errors.join('; '));
  console.log(`${checks} browser checks passed`);
} finally { if (browser) await browser.close(); if (server) server.kill(); }
