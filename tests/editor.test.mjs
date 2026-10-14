import test from 'node:test';
import assert from 'node:assert/strict';
import * as editor from '../src/editor.js';

test('edited cells validate numbers without changing the active dataset', () => {
  const result = editor.datasetFromTable(['категория', 'сумма'], [['еда', '12,5'], ['такси', '8']]);
  assert.equal(result.dataset.rows[0].сумма, 12.5);
  assert.equal(result.dataset.rawRows[0].сумма, '12,5');
  const invalid = editor.datasetFromTable(['категория', 'сумма'], [['еда', 'ошибка'], ['такси', '8']]);
  assert.equal(invalid.dataset, null);
  assert.ok(invalid.errors.some(error => error.code === 'invalid-number'));
});

test('draft restores validated data and settings and rejects corruption', () => {
  const dataset = editor.datasetFromTable(['категория', 'сумма'], [['еда', '12'], ['такси', '8']]).dataset;
  const state = { dataset, title: 'расходы', unit: '₽', mode: 'bars', summary: 'total', theme: 'archive', size: 'stories', valueKey: 'сумма' };
  const draft = editor.readDraft(editor.serializeDraft(state));
  assert.equal(draft.dataset.rows[1].сумма, 8);
  assert.equal(draft.summary, 'total');
  assert.equal(draft.size, 'stories');
  assert.equal(editor.readDraft('{broken'), null);
  assert.equal(editor.readDraft(JSON.stringify({ version: 1, headers: ['сумма'], rows: [{ сумма: 'bad' }, { сумма: 2 }] })), null);
  const invalidMode = JSON.parse(editor.serializeDraft(state));
  invalidMode.settings.mode = 'script';
  assert.equal(editor.readDraft(JSON.stringify(invalidMode)).mode, 'bars');
});
