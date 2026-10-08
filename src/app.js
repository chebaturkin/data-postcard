import { parseText, inferColumns, parseNumber, parseDate } from './data.js';
import { buildScene } from './scene.js';
import { exportSvg, exportPng, exportStandaloneHtml } from './export.js';

const SAMPLES = {
  reading: { label: 'sample reading', title: 'Неделя чтения', caption: 'Семь дней, когда у меня нашлось время для книги.', unit: 'минуты', headers: ['день', 'минуты'], rows: [['понедельник', 32], ['вторник', 48], ['среда', 26], ['четверг', 61], ['пятница', 42], ['суббота', 76], ['воскресенье', 53]] },
  weather: { label: 'sample weather', title: 'Окно на север', caption: 'Температура и свет в конце длинной недели.', unit: '°C', headers: ['дата', 'температура'], rows: [['2026-10-02', 11], ['2026-10-03', 13], ['2026-10-04', 8], ['2026-10-05', 7], ['2026-10-06', 10], ['2026-10-07', 12], ['2026-10-08', 9]] },
  sport: { label: 'sample sport', title: 'Дворовая дистанция', caption: 'Круги после работы, пока площадка не опустела.', unit: 'круги', headers: ['дата', 'круги'], rows: [['2026-09-28', 4], ['2026-09-29', 6], ['2026-09-30', 5], ['2026-10-01', 8], ['2026-10-02', 7], ['2026-10-03', 10], ['2026-10-04', 9]] },
};

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
const state = { title: '', caption: '', unit: '', mode: 'bars', order: 'input', theme: 'paper', size: 'landscape', showMissing: true, categoryKey: '', valueKey: '', dateKey: '', sourceLabel: '', dataset: null, sample: 'reading', svg: '' };

function rowsForRender() {
  if (!state.dataset) return [];
  const rows = [...state.dataset.rows].filter((row) => state.showMissing || parseNumber(row[state.valueKey]) !== null);
  if (state.order === 'ascending' || state.order === 'descending') {
    const key = state.valueKey || state.categoryKey;
    rows.sort((a, b) => { const av = parseNumber(a[key]); const bv = parseNumber(b[key]); const left = av ?? String(a[key] ?? ''); const right = bv ?? String(b[key] ?? ''); return (left > right ? 1 : left < right ? -1 : 0) * (state.order === 'ascending' ? 1 : -1); });
  }
  return rows;
}

function setSelectOptions(id, options, selected) {
  const select = $(id); if (!select) return;
  select.innerHTML = options.map((option) => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join('');
  if (options.some((option) => option.value === selected)) select.value = selected;
}

function refreshColumns() {
  if (!state.dataset) return;
  const columns = state.dataset.columns || inferColumns(state.dataset.headers, state.dataset.rows);
  state.dataset.columns = columns;
  const category = columns.find((column) => column.type === 'category')?.key || state.dataset.headers[0];
  const value = columns.find((column) => column.type === 'number')?.key || state.dataset.headers[1] || state.dataset.headers[0];
  const date = columns.find((column) => column.type === 'date')?.key || '';
  if (!state.categoryKey || !state.dataset.headers.includes(state.categoryKey)) state.categoryKey = category;
  if (!state.valueKey || !state.dataset.headers.includes(state.valueKey)) state.valueKey = value;
  if (!state.dateKey || !state.dataset.headers.includes(state.dateKey)) state.dateKey = date;
  const categoryOptions = columns.filter((column) => column.type === 'category' || column.type === 'date').map((column) => ({ value: column.key, label: column.key }));
  const valueOptions = columns.filter((column) => column.type === 'number').map((column) => ({ value: column.key, label: column.key }));
  const dateOptions = columns.filter((column) => column.type === 'date').map((column) => ({ value: column.key, label: column.key }));
  setSelectOptions('category-select', categoryOptions.length ? categoryOptions : state.dataset.headers.map((key) => ({ value: key, label: key })), state.categoryKey);
  setSelectOptions('value-select', valueOptions.length ? valueOptions : state.dataset.headers.map((key) => ({ value: key, label: key })), state.valueKey);
  setSelectOptions('date-select', [{ value: '', label: 'не используется' }, ...dateOptions], state.dateKey);
}

function showErrors(errors = [], warnings = []) {
  const node = $('data-errors');
  const messages = [...errors.map((error) => error.message), ...warnings.slice(0, 2).map((warning) => warning.message)];
  node.hidden = messages.length === 0;
  node.textContent = messages.length ? messages.slice(0, 3).join(' ') : '';
  node.dataset.level = errors.length ? 'error' : 'warning';
}

function updateChrome() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.size = state.size;
  $('title-input').value = state.title;
  $('caption-input').value = state.caption;
  $('unit-input').value = state.unit;
  $('mode-select').value = state.mode;
  $('order-select').value = state.order;
  $('theme-select').value = state.theme;
  $('size-select').value = state.size;
  $('missing-toggle').checked = state.showMissing;
  const count = state.dataset?.rows?.length || 0;
  const headers = state.dataset?.headers?.length || 0;
  $('data-summary').textContent = `${count} строк · ${headers} колонки${state.sourceLabel ? ` · ${state.sourceLabel}` : ''}`;
  $('postcard-kicker').textContent = `${state.title} · ${String(count).padStart(2, '0')} наблюдений`;
  $('postcard-source').textContent = `локальная заметка · ${state.sourceLabel || 'ввод вручную'}`;
  $('postcard-date').textContent = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()).replace(/\./g, ' / ');
  $('postcard-stage').setAttribute('aria-label', state.size === 'stories' ? 'Открытка 1080 на 1920' : 'Открытка 1200 на 900');
  $('stage-size').textContent = state.size === 'stories' ? '1080 × 1920 · stories' : '1200 × 900 · landscape';
  $('stage-mode-note').innerHTML = `<span class="key-line" aria-hidden="true"></span> ${({ bars: 'полосы показывают относительную величину', dots: 'точки показывают долю наблюдений', calendar: 'сетка собирает дни в один лист', timeline: 'маршрут соединяет даты и значения' })[state.mode] || 'данные собраны в открытку'}`;
  const needsDate = ['calendar', 'timeline'].includes(state.mode) && !state.dateKey;
  const selectedValues = state.dataset?.rows?.map((row) => parseNumber(row[state.valueKey])).filter((value) => value !== null) || [];
  const status = needsDate ? 'этому виду нужна колонка даты' : selectedValues.length ? `${count} строк · ${state.mode}` : 'в выбранной колонке нет чисел';
  $('render-status').textContent = status;
}

function render() {
  if (!state.dataset) return;
  refreshColumns();
  updateChrome();
  const rows = rowsForRender();
  state.svg = buildScene({ rows, state, dataset: state.dataset, themeName: state.theme });
  $('postcard-preview').outerHTML = state.svg.replace('<svg ', '<svg id="postcard-preview" class="postcard-preview" ');
  $('postcard-paper').dataset.theme = state.theme;
}

function loadDataset(dataset, meta = {}) {
  state.dataset = dataset;
  state.sourceLabel = meta.sourceLabel || 'локальный набор';
  state.sample = meta.sample || '';
  state.title = meta.title || 'Новая заметка';
  state.caption = meta.caption || 'Маленькая история, собранная из ваших строк.';
  state.unit = meta.unit || '';
  state.mode = dataset.columns?.some((column) => column.type === 'date') ? 'timeline' : 'bars';
  state.categoryKey = dataset.columns?.find((column) => column.type === 'category')?.key || dataset.headers[0];
  state.valueKey = dataset.columns?.find((column) => column.type === 'number')?.key || dataset.headers[1] || dataset.headers[0];
  state.dateKey = dataset.columns?.find((column) => column.type === 'date')?.key || '';
  refreshColumns();
  showErrors(meta.errors || dataset.errors || [], meta.warnings || dataset.warnings || []);
  render();
}

function loadSample(name) {
  const sample = SAMPLES[name] || SAMPLES.reading;
  const parsed = parseText([sample.headers.join(','), ...sample.rows.map((row) => row.join(','))].join('\n'), `${name}.csv`);
  if (parsed.dataset) loadDataset(parsed.dataset, { ...sample, sample: name, sourceLabel: sample.label });
  $('render-status').textContent = `Загружен набор · ${sample.label}`;
}

async function readFile(file) {
  const parsed = parseText(await file.text(), file.name);
  if (!parsed.dataset) {
    showErrors(parsed.errors, parsed.warnings);
    $('render-status').textContent = 'Не удалось прочитать файл';
    return;
  }
  loadDataset(parsed.dataset, { sourceLabel: file.name, errors: parsed.errors, warnings: parsed.warnings });
}

function handlePaste() {
  const text = $('paste-input').value.trim();
  const parsed = parseText(text, text.startsWith('{') || text.startsWith('[') ? 'pasted.json' : 'pasted.csv', { pasted: true });
  if (!parsed.dataset) { showErrors(parsed.errors, parsed.warnings); $('render-status').textContent = 'Проверьте строки'; return; }
  loadDataset(parsed.dataset, { sourceLabel: 'вставленные строки', errors: parsed.errors, warnings: parsed.warnings });
}

function bind() {
  [['title-input', 'title'], ['caption-input', 'caption'], ['unit-input', 'unit']].forEach(([id, key]) => $(id).addEventListener('input', (event) => { state[key] = event.target.value; render(); }));
  [['mode-select', 'mode'], ['order-select', 'order'], ['theme-select', 'theme'], ['size-select', 'size'], ['category-select', 'categoryKey'], ['value-select', 'valueKey'], ['date-select', 'dateKey']].forEach(([id, key]) => $(id).addEventListener('change', (event) => { state[key] = event.target.value; render(); }));
  $('missing-toggle').addEventListener('change', (event) => { state.showMissing = event.target.checked; render(); });
  document.querySelectorAll('[data-sample]').forEach((button) => button.addEventListener('click', () => loadSample(button.dataset.sample)));
  const dropZone = $('drop-zone'); const fileInput = $('file-input'); const openPicker = () => fileInput.click();
  $('import-button').addEventListener('click', openPicker); dropZone.addEventListener('click', openPicker); dropZone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); } });
  ['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
  dropZone.addEventListener('drop', (event) => { const file = event.dataTransfer.files?.[0]; if (file) readFile(file); }); fileInput.addEventListener('change', () => { if (fileInput.files?.[0]) readFile(fileInput.files[0]); });
  $('paste-button').addEventListener('click', handlePaste);
  $('export-svg').addEventListener('click', () => exportSvg(state.svg, 'data-postcard.svg'));
  $('export-png').addEventListener('click', () => exportPng(state.svg, state.size === 'stories' ? 1080 : 1200, state.size === 'stories' ? 1920 : 900, 'data-postcard.png'));
  $('export-html').addEventListener('click', () => exportStandaloneHtml(state.svg, state.title, 'data-postcard.html', { title: state.title, caption: state.caption, unit: state.unit, mode: state.mode, theme: state.theme, size: state.size, headers: state.dataset?.headers || [], rows: state.dataset?.rows || [], rawRows: state.dataset?.rawRows || [] }));
}

document.addEventListener('DOMContentLoaded', () => { const sample = SAMPLES.reading; const parsed = parseText([sample.headers.join(','), ...sample.rows.map((row) => row.join(','))].join('\n'), 'reading.csv'); loadDataset(parsed.dataset, { ...sample, sourceLabel: sample.label }); bind(); render(); });
window.DataPostcard = { state, samples: SAMPLES, render, loadSample, loadDataset };
