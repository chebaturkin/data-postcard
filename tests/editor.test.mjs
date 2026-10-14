import test from 'node:test';
import assert from 'node:assert/strict';
import { readProject, serializeProject } from '../src/project.js';
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

test('table errors locate numeric and date cells using the visible row numbers', () => {
  const headers = [' дата ', 'сумма'];
  const result = editor.datasetFromTable(headers, [['oops', '12'], ['2026-10-02', 'bad']]);
  const cells = editor.tableErrorCells(headers, result.errors);
  assert.deepEqual(cells.map(({ rowIndex, columnIndex }) => [rowIndex, columnIndex]), [[0, 0], [1, 1]]);
  assert.match(cells[0].message, /^строка 1, колонка «дата»/);
  assert.match(cells[1].message, /^строка 2, колонка «сумма»/);
  assert.equal(result.errors[0].row, 2, 'source-file coordinates remain unchanged');
});

test('table errors locate blank and duplicate headers, including case differences', () => {
  const headers = ['', 'день', 'День'];
  const result = editor.datasetFromTable(headers, [['a', 'b', 'c'], ['d', 'e', 'f']]);
  assert.deepEqual(editor.tableErrorCells(headers, result.errors).map(({ rowIndex, columnIndex }) => [rowIndex, columnIndex]), [[null, 0], [null, 2]]);
});

test('missing values and errors without a cell never highlight an unrelated field', () => {
  const result = editor.datasetFromTable(['день', 'сумма'], [['пн', ''], ['вт', '2']]);
  assert.deepEqual(editor.tableErrorCells(result.dataset.headers, result.errors), []);
  assert.deepEqual(editor.tableErrorCells(['сумма'], [{ code: 'row-count', row: 2, message: 'слишком мало строк' }, { code: 'invalid-number', row: 99, column: 'нет', message: 'ошибка' }]), []);
});

test('draft preserves unapplied invalid cells separately from the valid scene', () => {
  const dataset = editor.datasetFromTable(['день', 'сумма'], [['пн', '12'], ['вт', '8']]).dataset;
  const pendingTable = { headers: ['день', 'сумма'], rows: [['пн', 'ошибка'], ['вт', '8']] };
  const draft = editor.readDraft(editor.serializeDraft({ dataset, pendingTable }));
  assert.deepEqual(draft.pendingTable, pendingTable);
  assert.equal(draft.dataset.rows[0].сумма, 12);
});

test('pending cell longer than 2000 characters survives draft and portable round trips', () => {
  const dataset = editor.datasetFromTable(['день', 'сумма'], [['пн', '12'], ['вт', '8']]).dataset;
  const pendingTable = { headers: ['день', 'сумма'], rows: [['x'.repeat(2001), '12'], ['вт', '8']] };
  assert.deepEqual(editor.readDraft(editor.serializeDraft({ dataset, pendingTable })).pendingTable, pendingTable);
  assert.deepEqual(readProject(serializeProject({ dataset, pendingTable })).project.pendingTable, pendingTable);
});
