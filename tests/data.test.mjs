import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseJson, parseText, inferColumns, validateDataset, normalizeDataset } from '../src/data.js';

test('parseCsv handles quoted commas, BOM, and empty values', () => {
  const result = parseCsv('\uFEFFname,score,note\n"A, one",12,"hello\nworld"\nB,,ok');
  assert.deepEqual(result.headers, ['name', 'score', 'note']);
  assert.equal(result.rows[0].name, 'A, one');
  assert.equal(result.rows[0].note, 'hello\nworld');
  assert.equal(result.rows[1].score, '');
});

test('parseJson accepts arrays and object-wrapped arrays', () => {
  assert.deepEqual(parseJson('[{"day":"Mon","value":3}]').rows, [{ day: 'Mon', value: 3 }]);
  assert.deepEqual(parseJson('{"items":[{"day":"Tue","value":4}]}').rows, [{ day: 'Tue', value: 4 }]);
});

test('inferColumns classifies number, date, and category columns', () => {
  const headers = ['label', 'value', 'date'];
  const rows = [
    { label: 'A', value: '12', date: '2026-10-01' },
    { label: 'B', value: '8.5', date: '2026-10-02' },
  ];
  const columns = inferColumns(headers, rows);
  assert.equal(columns.find((c) => c.key === 'value').type, 'number');
  assert.equal(columns.find((c) => c.key === 'date').type, 'date');
  assert.equal(columns.find((c) => c.key === 'label').type, 'category');
});

test('validateDataset reports duplicate headers and invalid number values', () => {
  const result = validateDataset(['name', 'score', 'score'], [
    { name: 'A', score: 'oops' },
    { name: 'B', score: '2' },
  ]);
  assert.ok(result.errors.some((error) => error.code === 'duplicate-header'));
  assert.ok(result.errors.some((error) => error.code === 'invalid-number'));
});

test('validateDataset warns about missing values without converting them to zero', () => {
  const result = validateDataset(['name', 'score'], [
    { name: 'A', score: '' },
    { name: 'B', score: '2' },
  ]);
  assert.equal(result.rows[0].score, null);
  assert.ok(result.warnings.some((warning) => warning.code === 'missing-value'));
});

test('parseText returns a normalized dataset and clear file errors', () => {
  const result = parseText('name,score\nA,1\nB,2\nC,3\nD,4\nE,5', 'scores.csv');
  assert.equal(result.errors.length, 0);
  assert.equal(result.dataset.rows.length, 5);
  const empty = parseText('', 'empty.csv');
  assert.ok(empty.errors.some((error) => error.code === 'empty-file'));
});

test('normalizeDataset pads short rows and preserves headers', () => {
  const result = normalizeDataset({ headers: ['a', 'b'], rows: [['x'], ['y', '2']] });
  assert.deepEqual(result.rows, [{ a: 'x', b: '' }, { a: 'y', b: '2' }]);
});

test('validateDataset reports mixed dates and row-count bounds', () => {
  const mixed = validateDataset(['date', 'value'], [
    { date: '2026-10-01', value: '1' },
    { date: 'not a date', value: '2' },
    { date: '2026-10-03', value: '3' },
    { date: '2026-10-04', value: '4' },
    { date: '2026-10-05', value: '5' },
  ]);
  assert.ok(mixed.errors.some((error) => error.code === 'invalid-date'));
  assert.equal(mixed.rows[0].date, '2026-10-01');
  assert.ok(validateDataset(['x'], [{ x: 1 }]).errors.some((error) => error.code === 'row-count'));
});

test('parseCsv reports inconsistent rows and parseJson reports malformed JSON', () => {
  const csv = parseCsv('name,value\nA,1\nB,2,extra');
  assert.ok(csv.errors.some((error) => error.code === 'inconsistent-row'));
  const json = parseJson('{"items": [');
  assert.ok(json.errors.some((error) => error.code === 'invalid-json'));
});

test('parseNumber accepts mixed thousands separators and parseDate is timezone-stable', async () => {
  const data = await import('../src/data.js');
  assert.equal(data.parseNumber('1.234,56'), 1234.56);
  assert.equal(data.parseDate('Oct 1, 2026'), '2026-10-01');
});
