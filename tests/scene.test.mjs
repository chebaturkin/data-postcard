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

  assert.match(svg, /без корректной даты · 2 строки/);
});

test('summary shows a chosen meaningful aggregate or can be hidden', () => {
  const base = { rows: [{ name: 'пн', value: 10 }, { name: 'вт', value: 20 }], state: { title: 'неделя', categoryKey: 'name', valueKey: 'value', unit: 'мин' } };
  const total = buildScene({ ...base, state: { ...base.state, summary: 'total' } });
  assert.match(total, /всего/);
  assert.match(total, /30 мин/);
  assert.doesNotMatch(total, /Σ|μ|наблюдений/);
  const average = buildScene({ ...base, state: { ...base.state, summary: 'average' } });
  assert.match(average, /в среднем/);
  assert.match(average, /15 мин/);
  const hidden = buildScene({ ...base, state: { ...base.state, summary: 'none' } });
  assert.doesNotMatch(hidden, /всего|в среднем/);
});

test('an explicitly unused date column is not inferred back into the scene', () => {
  const svg = buildScene({ rows: [{ date: '2026-10-01', value: 2 }, { date: '2026-10-02', value: 3 }], dataset: { headers: ['date', 'value'], columns: [{ key: 'date', type: 'date' }, { key: 'value', type: 'number' }] }, state: { mode: 'timeline', dateKey: '', valueKey: 'value' } });
  assert.match(svg, /нужна колонка с датой/);
});

test('empty scene uses lowercase correction copy', () => {
  const svg = buildScene({ rows: [], state: { title: 'Заметка', caption: '', mode: 'bars', size: 'landscape' } });
  assert.match(svg, /нет строк для отображения/);
  assert.match(svg, /добавьте строки данных, чтобы собрать открытку/);
});

test('calendar labels keep the postcard copy in lowercase', () => {
  const svg = buildScene({
    rows: [{ date: '2026-10-01', value: 4 }],
    dataset: { headers: ['date', 'value'], columns: [{ key: 'date', type: 'date' }, { key: 'value', type: 'number' }] },
    state: { title: 'дворовая дистанция', caption: 'круги после работы.', unit: 'круги', mode: 'calendar', dateKey: 'date', valueKey: 'value', size: 'landscape' },
  });
  assert.match(svg, />круги<\/text>/);
  assert.match(svg, /октябрь 2026 г/);
  assert.match(svg, />п<\/text>/);
});
