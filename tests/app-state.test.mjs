import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseDefaultMode, modeLabel, sourceLabel, canActivateDataset, sortRowsForDisplay, isSupportedFile, fileImportError, MAX_FILE_BYTES } from '../src/app-state.js';

test('chooseDefaultMode selects a timeline only for date and number columns', () => {
  assert.equal(chooseDefaultMode([{ type: 'date' }, { type: 'number' }]), 'timeline');
  assert.equal(chooseDefaultMode([{ type: 'date' }, { type: 'category' }]), 'calendar');
  assert.equal(chooseDefaultMode([{ type: 'number' }, { type: 'category' }]), 'bars');
  assert.equal(chooseDefaultMode([{ type: 'number' }]), 'dots');
});

test('modeLabel keeps technical identifiers out of visible status copy', () => {
  assert.equal(modeLabel('bars'), 'полосы');
  assert.equal(modeLabel('timeline'), 'временной маршрут');
  assert.equal(modeLabel('unknown'), 'представление');
});

test('sourceLabel localizes known source names and falls back to a useful label', () => {
  assert.equal(sourceLabel('sample reading'), 'чтение');
  assert.equal(sourceLabel('sample weather'), 'погода');
  assert.equal(sourceLabel('pasted data'), 'вставленные строки');
  assert.equal(sourceLabel('metrics.csv'), 'metrics.csv');
});

test('canActivateDataset only accepts a valid renderable dataset', () => {
  assert.equal(canActivateDataset({ valid: true, rows: [{ value: 1 }] }), true);
  assert.equal(canActivateDataset({ valid: false, rows: [{ value: 1 }] }), false);
  assert.equal(canActivateDataset({ valid: true, rows: [] }), false);
  assert.equal(canActivateDataset(null), false);
});

test('sortRowsForDisplay keeps missing values last and preserves equal-value order', () => {
  const rows = [
    { label: 'missing', score: '' },
    { label: 'ten-a', score: '10' },
    { label: 'two', score: '2' },
    { label: 'ten-b', score: '10' },
  ];
  const parseValue = (value) => value === '' ? null : Number(value);

  assert.deepEqual(
    sortRowsForDisplay(rows, { order: 'ascending', key: 'score', parseValue }).map((row) => row.label),
    ['two', 'ten-a', 'ten-b', 'missing']
  );
  assert.deepEqual(
    sortRowsForDisplay(rows, { order: 'descending', key: 'score', parseValue }).map((row) => row.label),
    ['ten-a', 'ten-b', 'two', 'missing']
  );
  assert.deepEqual(
    sortRowsForDisplay(rows, { order: 'input', key: 'score', parseValue }).map((row) => row.label),
    ['missing', 'ten-a', 'two', 'ten-b']
  );
});

test('file import policy accepts supported files and rejects unsafe or oversized ones', () => {
  assert.equal(isSupportedFile({ name: 'notes.csv', type: 'text/csv', size: 12 }), true);
  assert.equal(isSupportedFile({ name: 'notes.json', type: '', size: 12 }), true);
  assert.equal(isSupportedFile({ name: 'notes.exe', type: 'application/octet-stream', size: 12 }), false);
  assert.equal(isSupportedFile({ name: 'notes.csv', type: 'application/javascript', size: 12 }), false);
  assert.equal(fileImportError({ name: 'notes.csv', type: 'text/csv', size: MAX_FILE_BYTES + 1 }), 'файл слишком большой: максимум 1 МБ.');
  assert.equal(fileImportError({ name: 'notes.csv', type: 'text/csv', size: 12 }), '');
});
