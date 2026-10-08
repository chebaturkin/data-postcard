import test from 'node:test';
import assert from 'node:assert/strict';
import { exportPng, svgBlob, standaloneHtml, sanitizeFilename } from '../src/export.js';

test('svgBlob rejects empty markup so exports cannot produce a blank file', () => {
  assert.throws(() => svgBlob(''), /SVG/);
  assert.throws(() => svgBlob('   '), /SVG/);
});

test('sanitizeFilename keeps useful names and removes unsafe path characters', () => {
  assert.equal(sanitizeFilename('Неделя чтения / 07', 'postcard'), 'Неделя чтения 07');
  assert.equal(sanitizeFilename('   ', 'postcard'), 'postcard');
  assert.equal(sanitizeFilename('', 'postcard'), 'postcard');
});

test('svgBlob creates an SVG blob with postcard markup', async () => {
  const blob = svgBlob('<svg viewBox="0 0 1200 900"><title>Postcard</title></svg>');
  assert.equal(blob.type, 'image/svg+xml;charset=utf-8');
  assert.match(await blob.text(), /Postcard/);
});

test('standaloneHtml embeds SVG without network dependencies', () => {
  const html = standaloneHtml('<svg viewBox="0 0 1200 900"><title>Offline</title></svg>', 'Offline Postcard');
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Offline Postcard/);
  assert.match(html, /<svg viewBox/);
  assert.doesNotMatch(html, /https?:\/\//);
});


test('standaloneHtml escapes embedded metadata script delimiters', () => {
  const html = standaloneHtml('<svg></svg>', 'Safe', { caption: '</script><script>alert(1)</script>' });
  assert.doesNotMatch(html, /<\/script><script>alert/);
  assert.ok(html.includes('\\u003c/script'));
});

test('exportPng rejects image failures and revokes its temporary URL', async () => {
  const previousImage = globalThis.Image;
  const previousUrl = globalThis.URL;
  let revoked = 0;

  class BrokenImage {
    set src(value) {
      queueMicrotask(() => this.onerror?.(new Error('decode failed')));
    }
  }

  globalThis.Image = BrokenImage;
  globalThis.URL = {
    createObjectURL() { return 'blob:test-svg'; },
    revokeObjectURL() { revoked += 1; },
  };

  try {
    await assert.rejects(exportPng('<svg></svg>', 1200, 900), /image/i);
    assert.equal(revoked, 1);
  } finally {
    globalThis.Image = previousImage;
    globalThis.URL = previousUrl;
  }
});

test('exportPng rejects when a 2D canvas context is unavailable', async () => {
  const previousImage = globalThis.Image;
  const previousDocument = globalThis.document;
  const previousUrl = globalThis.URL;

  class LoadedImage {
    set src(value) {
      queueMicrotask(() => this.onload?.());
    }
  }

  globalThis.Image = LoadedImage;
  globalThis.document = {
    createElement(name) {
      assert.equal(name, 'canvas');
      return { getContext() { return null; } };
    },
  };
  globalThis.URL = {
    createObjectURL() { return 'blob:test-svg'; },
    revokeObjectURL() {},
  };

  try {
    await assert.rejects(exportPng('<svg></svg>', 1200, 900), /canvas/i);
  } finally {
    globalThis.Image = previousImage;
    globalThis.document = previousDocument;
    globalThis.URL = previousUrl;
  }
});
