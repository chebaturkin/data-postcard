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
  assert.equal(empty.errors.find((error) => error.code === 'empty-file').message, 'файл пустой.');
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
  assert.equal(data.parseNumber('.5'), 0.5);
  assert.equal(data.parseNumber(',5'), 0.5);
  assert.equal(data.parseDate('Oct 1, 2026'), '2026-10-01');
});

test('parseJson trims headers without losing their values', () => {
  const result = parseJson('[{" date ":"2026-10-01"," value ":3}]');
  assert.deepEqual(result.headers, ['date', 'value']);
  assert.deepEqual(result.rows[0], { date: '2026-10-01', value: 3 });
});

test('parseCsv treats whitespace-only input as empty', () => {
  const result = parseCsv('\n\r\n');
  assert.ok(result.errors.some((error) => error.code === 'empty-file'));
});

test('parseText blocks datasets that do not meet the row-count contract', () => {
  const result = parseText('name,score\nA,1\nB,2\nC,3\nD,4', 'scores.csv');
  assert.equal(result.dataset, null);
  assert.ok(result.errors.some((error) => error.code === 'row-count'));
});

test('parseText blocks invalid inferred number and date values', () => {
  const invalidNumber = parseText(
    'date,value\n2026-10-01,1\n2026-10-02,2\n2026-10-03,nope\n2026-10-04,4\n2026-10-05,5',
    'values.csv'
  );
  assert.equal(invalidNumber.dataset, null);
  assert.ok(invalidNumber.errors.some((error) => error.code === 'invalid-number'));

  const invalidDate = parseText(
    'date,value\n2026-10-01,1\n2026-10-02,2\nnot-a-date,3\n2026-10-04,4\n2026-10-05,5',
    'values.csv'
  );
  assert.equal(invalidDate.dataset, null);
  assert.ok(invalidDate.errors.some((error) => error.code === 'invalid-date'));
});

test('parseText blocks duplicate headers after cleaning while retaining both source cells', () => {
  const source = [
    'name, score ,score',
    'A,1,10',
    'B,2,20',
    'C,3,30',
    'D,4,40',
    'E,5,50',
  ].join('\n');
  const parsed = parseCsv(source);
  assert.deepEqual(parsed.headers, ['name', 'score', 'score__2']);
  assert.deepEqual(parsed.rows[0], { name: 'A', score: '1', score__2: '10' });
  assert.ok(parsed.errors.some((error) => error.code === 'duplicate-header'));

  const result = parseText(source, 'scores.csv');
  assert.equal(result.dataset, null);
  assert.ok(result.errors.some((error) => error.code === 'duplicate-header'));
});

test('parseCsv reports non-whitespace characters after a closing quote', () => {
  const result = parseCsv('name,score\n"A"x,1\nB,2\nC,3\nD,4\nE,5');
  assert.ok(result.errors.some((error) => error.code === 'csv-parse'));
});

test('parseText accepts explicit source mode options without changing the legacy signature', () => {
  const source = 'name,score\nA,1\nB,2\nC,3\nD,4\nE,5';
  const pasted = parseText(source, 'scores.csv', { source: 'paste' });
  assert.equal(pasted.dataset.sourceMode, 'paste');
  const file = parseText(source, 'scores.csv');
  assert.equal(file.dataset.sourceMode, 'file');
});

test('parseText honors an explicit CSV filename before content sniffing', () => {
  const result = parseText('[name],score\nA,1\nB,2\nC,3\nD,4\nE,5', 'values.csv');
  assert.equal(result.errors.length, 0);
  assert.equal(result.dataset.headers[0], '[name]');
});

test('parseText does not duplicate the root JSON parse error with an empty-file error', () => {
  const result = parseText('{"items": [', 'broken.json');
  assert.equal(result.dataset, null);
  assert.equal(result.errors.filter((error) => error.code === 'invalid-json').length, 1);
  assert.equal(result.errors.filter((error) => error.code === 'empty-file').length, 0);
});
