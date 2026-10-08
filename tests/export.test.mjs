import test from 'node:test';
import assert from 'node:assert/strict';
import { svgBlob, standaloneHtml } from '../src/export.js';

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
