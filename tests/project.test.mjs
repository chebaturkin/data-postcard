import test from 'node:test';
import assert from 'node:assert/strict';
import { datasetFromTable, serializeDraft, readDraft } from '../src/editor.js';
import { MAX_FILE_BYTES } from '../src/app-state.js';

import * as project from '../src/project.js';
const makeState = () => ({
  dataset: datasetFromTable(['дата', 'сумма', 'подпись'], [['2026-10-01', '12,5', '<утро>'], ['2026-10-02', '', 'вечер']]).dataset,
  title: 'мой график', caption: '</script><script>test</script>', unit: '₽', mode: 'timeline',
  summary: 'average', order: 'descending', theme: 'archive', size: 'stories', showMissing: false,
  categoryKey: 'подпись', valueKey: 'сумма', dateKey: '', sourceLabel: 'таблица.csv', sample: '',
});

test('portable project round trip retains raw data and every draft setting', () => {
  const state = makeState();
  const before = JSON.stringify(state);
  const text = project.serializeProject(state);
  const envelope = JSON.parse(text);
  assert.equal(envelope.type, 'data-postcard');
  assert.equal(envelope.version, 1);
  const loaded = project.readProject(text);
  assert.equal(loaded.error, '');
  assert.deepEqual(loaded.project, readDraft(serializeDraft(state)));
  assert.equal(loaded.project.dataset.rawRows[0].сумма, '12,5');
  assert.equal(loaded.project.dataset.rows[1].сумма, null);
  assert.equal(loaded.project.dateKey, '', 'explicit unused date is retained');
  assert.equal(JSON.stringify(state), before, 'saving never mutates the active dataset');
});

test('project loader distinguishes ordinary data, damaged JSON and future versions', () => {
  for (const text of ['[{"name":"а","value":1},{"name":"б","value":2}]', '{broken', 'null', '', JSON.stringify({ type: 'data-postcard', version: 2 })]) {
    const result = project.readProject(text);
    assert.equal(result.project, null);
    assert.ok(result.error);
  }
});

test('invalid project data never becomes an active dataset', () => {
  const saved = JSON.parse(project.serializeProject(makeState()));
  for (const change of [
    copy => { copy.rows[0].сумма = 'oops'; },
    copy => { copy.rows[0].дата = '2026-02-30'; },
    copy => { copy.rows = copy.rows.slice(0, 1); },
    copy => { copy.headers[1] = copy.headers[0]; },
    copy => { copy.rows[0].подпись = { nested: 'data' }; },
    copy => { copy.rows[0].extra = 'do not silently discard'; },
    copy => { delete copy.rows[0].подпись; },
    copy => { copy.headers = [42]; },
    copy => { copy.settings = []; },
    copy => { copy.settings.theme = 'unknown'; },
    copy => { copy.settings.showMissing = 'false'; },
    copy => { copy.settings.title = { nested: 'text' }; },
  ]) {
    const copy = structuredClone(saved);
    change(copy);
    const result = project.readProject(JSON.stringify(copy));
    assert.equal(result.project, null, JSON.stringify(copy));
    assert.ok(result.error);
  }
});

test('portable projects enforce the byte limit, including multibyte text', () => {
  const text = 'я'.repeat(MAX_FILE_BYTES / 2 + 1);
  assert.ok(text.length < MAX_FILE_BYTES);
  assert.equal(project.readProject(text).project, null);
  assert.match(project.readProject(text).error, /1 мб/);
  const state = makeState();
  state.dataset.rawRows[0].подпись = text;
  assert.throws(() => project.serializeProject(state), /1 мб/);
});

test('project file policy rejects unsupported files before reading them', () => {
  assert.equal(project.projectFileError({ name: 'итоги.postcard.json', size: 100 }), '');
  assert.ok(project.projectFileError({ name: 'data.csv', size: 100 }));
  assert.match(project.projectFileError({ name: 'big.json', size: MAX_FILE_BYTES + 1 }), /1 мб/);
});
