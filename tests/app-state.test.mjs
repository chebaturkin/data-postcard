import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseDefaultMode, modeLabel, sourceLabel, canActivateDataset } from '../src/app-state.js';

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
