import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScene } from '../src/scene.js';

test('timeline explains rows whose dates cannot be placed on the route', () => {
  const svg = buildScene({
    rows: [
      { label: 'A', date: '2026-10-01', value: 2 },
      { label: 'B', date: '2026-10-02', value: 4 },
      { label: 'C', date: 'not-a-date', value: 3 },
      { label: 'C2', date: 'also-not-a-date', value: 6 },
      { label: 'D', date: '2026-10-04', value: 1 },
      { label: 'E', date: '2026-10-05', value: 5 },
    ],
    state: {
      title: 'Тест маршрута',
      caption: 'Проверка пропусков',
      mode: 'timeline',
      categoryKey: 'label',
      valueKey: 'value',
      dateKey: 'date',
      size: 'landscape',
    },
    dataset: {
      headers: ['label', 'date', 'value'],
      columns: [
        { key: 'label', type: 'category' },
        { key: 'date', type: 'date' },
        { key: 'value', type: 'number' },
      ],
    },
  });

  assert.match(svg, /Без корректной даты · 2 строки/);
});
