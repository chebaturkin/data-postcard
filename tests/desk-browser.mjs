export async function checkDesk({ page, url, check }) {
  await page.goto(url);
  await page.locator('#reset-draft').click();
  await page.locator('#table-body input').nth(1).fill('ошибка');
  await page.reload();
  check(await page.locator('#table-body input').nth(1).inputValue() === 'ошибка', 'unapplied invalid input survives reload');
  check((await page.locator('#postcard-preview').textContent()).includes('338'), 'raw draft restoration keeps previous valid scene');
  await page.locator('#sample-select').selectOption('expenses');
  await page.locator('#undo-source').click();
  check(await page.locator('#table-body input').nth(1).inputValue() === 'ошибка', 'undo restores unapplied cells after source replacement');
  await page.locator('#reset-draft').click();
  await page.locator('#tab-design').click();
  await page.locator('[name=\"graph-mode\"][value=\"' + 'calendar' + '\"]').check();
  for (const format of ['png', 'svg', 'html']) check(await page.locator('#export-' + format).isDisabled(), `${format} disabled for diagnostic scene`);
  await page.locator('#tab-data').click();
  await page.locator('#import-details summary').click();
  await page.locator('#paste-input').fill('дата,событие\n2026-10-01,встреча\n2026-10-02,прогулка\n2026-10-03,');
  await page.locator('#paste-button').click();
  await page.locator('#tab-design').click();
  await page.locator('#missing-toggle').uncheck();
  check((await page.locator('#postcard-preview').textContent()).includes('встреча'), 'calendar text survives hiding empty cells');
  await page.locator('#reset-draft').click();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const trigger = page.locator(width < 1040 ? '#compact-view' : '#view-postcard');
    await trigger.focus(); await page.keyboard.press('Enter');
    check(await page.locator('#postcard-viewer').isVisible(), `large viewer opens at ${width}`);
    check(await page.locator('#viewer-image svg').count() === 1, `large viewer contains actual postcard at ${width}`);
    await page.keyboard.press('Escape');
    check(!(await page.locator('#postcard-viewer').isVisible()), `escape closes viewer at ${width}`);
    check(await trigger.evaluate(node => node === document.activeElement), `viewer restores focus at ${width}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `desk fits ${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('#reset-draft').click();
  await page.locator('#table-body input').nth(3).fill('');
  await page.locator('#apply-table').click();
  check((await page.locator('#data-warnings').textContent()).includes('строка 2'), 'valid missing-cell warning uses the displayed table row');
  await page.locator('#table-body input').nth(1).fill('ошибка');
  await page.locator('#view-postcard').click();
  await page.locator('[data-export="png"]').click();
  check(!(await page.locator('#postcard-viewer').isVisible()), 'invalid export leaves modal and opens correction');
  check(await page.locator('#table-body input').nth(1).evaluate(node => node === document.activeElement), 'viewer export focuses the invalid input');
  await page.locator('#reset-draft').click();
}
