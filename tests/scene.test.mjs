import { setLocale } from '../i18n.js';
setLocale('ru');
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

test('the scene exposes export eligibility and full density warnings', async () => {
  const { sceneDiagnostics } = await import('../src/scene.js');
  assert.equal(typeof sceneDiagnostics, 'function');
  assert.equal(sceneDiagnostics({ rows: [], state: { mode: 'bars' } }).exportable, false);
  assert.equal(sceneDiagnostics({ rows: [{ n: 'встреча', date: '2026-10-02' }], state: { mode: 'calendar', valueKey: 'n', dateKey: 'date' } }).exportable, true);
  assert.equal(sceneDiagnostics({ rows: [{ v: 1 }], state: { mode: 'timeline', valueKey: 'v', dateKey: '' } }).exportable, false);
  assert.ok(sceneDiagnostics({ rows: Array.from({length:20}, (_,i) => ({ n: 'категория '+i, v: i })), state: { mode:'bars', categoryKey:'n',valueKey:'v', size:'landscape' } }).warnings.length);
});

test('summary belongs to the footer and actual local fonts are embedded', () => {
  const svg = buildScene({ rows: [{name:'пн',value:10},{name:'вт',value:20}],state:{title:'чтение',caption:'',categoryKey:'name',valueKey:'value',summary:'total',unit:'мин'} });
  assert.match(svg, /data-scene="footer"[^]*всего/);
  assert.doesNotMatch(svg, /paper-lines|маленькая история|без названия/);
  assert.match(svg, /@font-face[^]*data:font\/woff2;base64/);
  assert.match(svg, /<desc[^]*2 строки/);
});

test('sparse calendar keeps every text event in a readable register', () => {
  const rows=Array.from({length:20},(_,i)=>({date:`${2025+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}-01`,event:'событие '+i}));
  const svg=buildScene({rows,state:{mode:'calendar',dateKey:'date',valueKey:'event'}});
  assert.match(svg,/data-calendar-layout="register"/);
  for(let i=0;i<20;i++) assert.match(svg,new RegExp('событие '+i+'(?:<|;)'));
});

test('duplicate timeline dates retain individual values without overlapping point labels', () => {
  const svg=buildScene({rows:[{date:'2026-10-01',value:1},{date:'2026-10-01',value:2},{date:'2026-10-02',value:3}],state:{mode:'timeline',dateKey:'date',valueKey:'value'}});
  assert.match(svg,/data-timeline-ledger/);
  assert.match(svg,/2026-10-01 · 1/);
  assert.match(svg,/2026-10-01 · 2/);
});

test('maximal broad-glyph copy blocks export when the date chart has no room', async () => {
  const { sceneDiagnostics } = await import('../src/scene.js');
  const rows=Array.from({length:20},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,value:i+1}));
  for(const mode of ['calendar','timeline']) {
    const options={rows,state:{mode,dateKey:'date',valueKey:'value',size:'landscape',title:'W'.repeat(120),caption:'W'.repeat(300)}};
    assert.equal(sceneDiagnostics(options).exportable,false,mode);
    assert.match(sceneDiagnostics(options).message,/сократите текст|сторис/);
  }
});

test('extreme numeric labels use compact notation and retain exact source values', () => {
  const svg=buildScene({rows:[{name:'один',value:1e30},{name:'два',value:2e30}],state:{mode:'bars',categoryKey:'name',valueKey:'value',summary:'none'}});
  assert.match(svg,/>1e30<\/text>/);
  assert.match(svg,/>2e30<\/text>/);
  assert.match(svg,/<title>один: 1e\+30<\/title>/);
  const tiny=buildScene({rows:[{name:'один',value:1e-30},{name:'два',value:2e-30}],state:{mode:'bars',categoryKey:'name',valueKey:'value',summary:'none'}});
  assert.match(tiny,/>1e-30<\/text>/);
});
