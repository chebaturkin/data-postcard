"""A locale change during image decoding must not change the pending PNG."""
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('APP_URL', 'http://127.0.0.1:4422/')

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(locale='en-US', accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL.rstrip('/') + '/?lang=en', wait_until='networkidle')
    original = page.evaluate('window.DataPostcard.state.svg')
    page.evaluate('''() => {
      window.exportSources = []; window.exportImagesStarted = 0;
      const createUrl = URL.createObjectURL;
      URL.createObjectURL = function(blob) {
        if (blob.type.startsWith('image/svg+xml')) exportSources.push(blob.text());
        return createUrl.call(this, blob);
      };
      const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true, get: src.get, set(value) {
          window.exportImagesStarted++; setTimeout(() => src.set.call(this, value), 150);
        }
      });
    }''')
    with page.expect_download() as download:
        page.locator('#export-png').evaluate('(node) => node.click()')
        page.wait_for_function('window.exportImagesStarted > 0')
        page.locator('[data-language="ru"]').evaluate('(node) => node.click()')
        expect(page.locator('html')).to_have_attribute('lang', 'ru')
        expect(page.locator('#title-input')).to_have_value('неделя чтения')
    assert download.value.suggested_filename == 'a week of reading.png'
    assert Path(download.value.path()).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    sources = page.evaluate('Promise.all(window.exportSources)')
    assert sources == [original]
    assert not re.search('[а-яёА-ЯЁ]', sources[0])
    assert 'неделя чтения' in page.evaluate('window.DataPostcard.state.svg')
    assert not errors, errors
    context.close()
    browser.close()
    print('postcard delayed image: PNG keeps its complete starting SVG and filename while the editor changes language')
