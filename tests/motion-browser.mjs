import { mkdir, readFile } from 'node:fs/promises';

export async function checkMotion({ page, context, url, root, check }) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('#reset-draft').click();
  await page.evaluate(() => { window.originalPreview = document.querySelector('#postcard-preview'); });
  await page.locator('#tab-text').click();
  await page.locator('#title-input').fill('моя неделя');
  check(await page.evaluate(() => window.originalPreview === document.querySelector('#postcard-preview')), 'text edits preserve the SVG root');
  await page.locator('#title-input').evaluate(input => input.setSelectionRange(1, 1));
  await page.locator('#title-input').press('x');
  check(await page.locator('#title-input').inputValue() === 'мxоя неделя', 'live preview preserves the insertion point');
  check(await page.evaluate(() => document.activeElement.id === 'title-input' && document.activeElement.selectionStart === 2), 'live text editing retains focus and selection');
  check(await page.evaluate(() => document.querySelector('#postcard-preview').getAnimations({ subtree: true }).length === 0), 'typing does not replay chart motion');

  await page.locator('#reset-draft').click();
  await page.locator('#tab-design').click();
  await page.waitForFunction(() => !document.querySelector('#postcard-paper').getAnimations({ subtree: true }).length);
  await page.evaluate(() => { window.firstChartRow = [...document.querySelectorAll('#postcard-preview g')].find(node => node.textContent.includes('понедельник') && node.textContent.includes('32') && !node.textContent.includes('вторник')); });
  await page.locator('#order-select').selectOption('descending');
  check(await page.evaluate(() => window.firstChartRow?.isConnected), 'sorting preserves row identity');
  check(await page.evaluate(() => document.querySelector('#postcard-preview').getAnimations({ subtree: true }).length > 0), 'sorting moves existing rows toward their new positions');
  await page.waitForFunction(() => !document.querySelector('#postcard-paper').getAnimations({ subtree: true }).length);
  check(await page.evaluate(() => [...document.querySelectorAll('#postcard-preview [data-row-key]')][0]?.textContent.includes('суббота')), 'sorted chart settles in the requested order');
  await page.evaluate(() => {
    for (const mode of ['dots', 'timeline', 'calendar', 'bars']) {
      const select = document.querySelector('#mode-select');
      select.value = mode; select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.waitForFunction(() => !document.querySelector('#postcard-paper').getAnimations({ subtree: true }).length);
  check((await page.locator('#postcard-preview').textContent()).includes('76'), 'rapid mode changes settle to the latest chart');
  check(await page.locator('#postcard-preview').count() === 1, 'rapid changes leave one complete preview');

  await page.locator('#tab-data').click();
  await page.locator('#table-body input').nth(1).fill('99');
  await page.locator('#apply-table').focus();
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => document.activeElement.id === 'apply-table'), 'applying data keeps keyboard focus');
  check((await page.locator('#render-status').textContent()).includes('обновлена'), 'successful application has a text result');
  const valid = await page.locator('#postcard-preview').innerHTML();
  await page.locator('#table-body input').nth(1).fill('ошибка');
  await page.locator('#apply-table').click();
  check(await page.locator('#postcard-preview').innerHTML() === valid, 'failed application does not animate or alter the valid chart');

  await page.locator('#reset-draft').click();
  await page.locator('#import-details summary').click();
  const fileDrag = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['категория,число\nа,1\nб,2'], 'data.csv', { type: 'text/csv' }));
    return transfer;
  });
  await page.locator('#drop-zone').dispatchEvent('dragenter', { dataTransfer: fileDrag });
  await page.locator('.drop-zone__title').dispatchEvent('dragenter', { dataTransfer: fileDrag });
  await page.locator('.drop-zone__title').dispatchEvent('dragleave');
  check((await page.locator('#drop-zone').getAttribute('class')).includes('is-dragging'), 'file target stays active across nested children');
  await page.locator('#drop-zone').dispatchEvent('dragleave');
  check(!(await page.locator('#drop-zone').getAttribute('class')).includes('is-dragging'), 'file target clears after leaving');
  const textDrag = await page.evaluateHandle(() => { const transfer = new DataTransfer(); transfer.setData('text/plain', 'текст'); return transfer; });
  await page.locator('#drop-zone').dispatchEvent('dragenter', { dataTransfer: textDrag });
  check(!(await page.locator('#drop-zone').getAttribute('class')).includes('is-dragging'), 'text dragging is not presented as an accepted file');
  await fileDrag.dispose();
  await textDrag.dispose();

  // Hold real canvas encoding so a second render occurs during PNG export.
  await page.evaluate(() => {
    window.originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
      window.releaseEncoding = () => window.originalToBlob.call(this, callback, ...args);
    };
  });
  const pendingPng = page.waitForEvent('download');
  await page.locator('#export-png').click();
  await page.waitForFunction(() => Boolean(window.releaseEncoding));
  check(await page.locator('#export-png').getAttribute('aria-busy') === 'true', 'PNG communicates actual work in progress');
  check(!(await page.locator('#render-status').textContent()).includes('файл png готов'), 'PNG does not report success before encoding');
  await page.locator('#tab-text').click();
  await page.locator('#title-input').fill('новый заголовок во время сохранения');
  check(await page.locator('#export-png').isDisabled(), 'rendering cannot re-enable a busy export');
  await page.evaluate(() => { window.releaseEncoding(); HTMLCanvasElement.prototype.toBlob = window.originalToBlob; });
  const png = await readFile(await (await pendingPng).path());
  check(png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 900, 'in-flight PNG keeps its captured format');
  check((await page.locator('#render-status').textContent()).includes('файл png готов'), 'PNG reports completed encoding');
  check(await page.locator('#export-png').isEnabled(), 'export can be repeated after completion');
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = callback => callback(null); });
  await page.locator('#export-png').click();
  await page.waitForFunction(() => document.querySelector('#render-status').dataset.level === 'error');
  check((await page.locator('#render-status').textContent()).includes('не удалось сохранить png'), 'encoding failure has an explicit text correction');
  check(await page.locator('#export-png').isEnabled(), 'encoding failure leaves export available for retry');
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = window.originalToBlob; });

  // Export the final model while a new paper/ink episode is still running.
  await page.locator('#tab-data').click();
  await page.locator('#sample-select').selectOption('expenses');
  const expectedSvg = await page.evaluate(() => window.DataPostcard.state.svg);
  for (const format of ['svg', 'html']) {
    const pending = page.waitForEvent('download');
    await page.locator('#export-' + format).click();
    const exported = await readFile(await (await pending).path(), 'utf8');
    check(format === 'svg' ? exported === expectedSvg : exported.includes(expectedSvg), `${format} exports the complete final model during motion`);
    check(!/animation:|@keyframes|data-feedback|postcard-preview|<animate/.test(exported), `${format} excludes editor motion`);
    if (format === 'html') {
      const offline = await context.newPage();
      await offline.route('**/*', route => route.abort());
      await offline.setContent(exported);
      check((await offline.locator('svg').textContent()).includes('расходы за сентябрь'), 'standalone HTML works without network access');
      await offline.close();
    }
  }
  await page.locator('#sample-select').selectOption('weather');
  const movingPngDownload = page.waitForEvent('download');
  await page.locator('#export-png').click();
  const movingPng = await readFile(await (await movingPngDownload).path());
  await page.waitForFunction(() => !document.querySelector('#postcard-paper').getAnimations({ subtree: true }).length);
  const settledPngDownload = page.waitForEvent('download');
  await page.locator('#export-png').click();
  const settledPng = await readFile(await (await settledPngDownload).path());
  check(movingPng.equals(settledPng), 'PNG pixels during motion equal the settled final export');
  await mkdir(root + 'test-results', { recursive: true });
  await page.locator('#reset-draft').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#sample-select').selectOption('content');
  await page.locator('#tab-design').click();
  await page.locator('[name=\"graph-mode\"][value=\"' + 'dots' + '\"]').check();
  check(await page.evaluate(() => document.getAnimations().length === 0), 'reduced motion disables CSS and programmatic effects immediately');
  check((await page.locator('#postcard-preview').textContent()).includes('месяц публикаций'), 'reduced motion still updates the complete postcard');
  await page.locator('#tab-data').focus();
  await page.keyboard.press('End');
  check(await page.locator('#tab-design').getAttribute('aria-selected') === 'true', 'keyboard tab navigation works with reduced motion');
  check(await page.locator('#tab-design').evaluate(node => getComputedStyle(node).outlineStyle !== 'none'), 'keyboard focus remains visible');

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('#reset-draft').click();
    for (let i = 0; i < 13; i++) await page.locator('#add-row').click();
    check(await page.locator('#add-row').isDisabled(), `20-row limit remains operable at ${width}px`);
    await page.locator('#table-body').evaluate(body => {
      [...body.rows].slice(7).forEach((row, index) => {
        row.querySelectorAll('input').forEach((input, column) => {
          input.value = column ? String(index * 11) : `дополнительная строка ${index + 1}`;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    });
    await page.locator('#apply-table').click();
    check(await page.locator('#postcard-preview [data-row-key]').count() === 20, `all 20 rows render at ${width}px`);
    await page.locator('#tab-text').click();
    await page.locator('#title-input').fill('длинный заголовок о привычках, заметках и небольших итогах за месяц '.repeat(2).slice(0, 120));
    await page.locator('#caption-input').fill('подробная заметка с контекстом и пояснениями к этим данным. '.repeat(5).slice(0, 300));
    await page.locator('#tab-design').click();
    for (const size of ['stories', 'landscape']) {
      await page.locator('#size-select').selectOption(size);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${size} and long copy fit at ${width}px`);
    }
    if (width === 390) {
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: root + 'test-results/motion-mobile.png', fullPage: true, animations: 'disabled' });
    }
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('#reset-draft').click();

  const fallback = await context.newPage();
  await fallback.addInitScript(() => { Element.prototype.animate = undefined; });
  await fallback.goto(url);
  await fallback.locator('#tab-text').click();
  await fallback.locator('#title-input').fill('без анимационного api');
  check((await fallback.locator('#postcard-preview').textContent()).includes('без анимационного api'), 'editor works without Web Animations API');
  await fallback.close();

  const touch = await context.browser().newContext({ locale: 'ru-RU', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touchPage = await touch.newPage();
  await touchPage.goto(url);
  await touchPage.locator('#tab-design').tap();
  await touchPage.locator('#theme-select').selectOption('night');
  await touchPage.locator('#size-select').selectOption('stories');
  check(await touchPage.locator('#postcard-paper').getAttribute('data-theme') === 'night', 'touch controls work without hover');
  await touch.close();
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: root + 'test-results/motion-wide.png', fullPage: true, animations: 'disabled' });
}
