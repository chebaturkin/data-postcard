import { parseText, inferColumns, parseNumber, MIN_ROWS, MAX_ROWS } from './data.js';
import { buildScene } from './scene.js';
import { THEMES } from './themes.js';
import { SAMPLES } from './samples.js';
import { datasetFromTable, serializeDraft, readDraft, DRAFT_KEY } from './editor.js';
import { exportSvg, exportPng, exportStandaloneHtml, sanitizeFilename } from './export.js';
import { chooseDefaultMode, canActivateDataset, sortRowsForDisplay, fileImportError } from './app-state.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
const state = { title: '', caption: '', unit: '', mode: 'bars', summary: 'total', order: 'input', theme: 'paper', size: 'landscape', showMissing: true, categoryKey: '', valueKey: '', dateKey: '', sourceLabel: '', dataset: null, sample: '', svg: '' };
let importRequest = 0;
let tableDirty = false;

function rowsForRender() {
  const rows = state.dataset.rows.filter(row => state.showMissing || parseNumber(row[state.valueKey]) !== null);
  return sortRowsForDisplay(rows, { order: state.order, key: state.valueKey || state.categoryKey, parseValue: parseNumber });
}

function setSelectOptions(id, columns, selected) {
  const select = $(id);
  select.innerHTML = columns.map(column => `<option value="${esc(column.key)}">${esc(column.name || column.key)}</option>`).join('');
  select.value = selected;
}

function refreshColumns() {
  const columns = state.dataset.columns || inferColumns(state.dataset.headers, state.dataset.rows);
  const headers = state.dataset.headers;
  if (!headers.includes(state.categoryKey)) state.categoryKey = columns.find(column => column.type === 'category')?.key || headers[0];
  if (!headers.includes(state.valueKey)) state.valueKey = columns.find(column => column.type === 'number')?.key || headers[1] || headers[0];
  if (state.dateKey && !headers.includes(state.dateKey)) state.dateKey = columns.find(column => column.type === 'date')?.key || '';
  const categories = columns.filter(column => column.type !== 'number');
  const values = columns.filter(column => column.type === 'number');
  // Retain the current selection even if column inference changed after editing.
  setSelectOptions('category-select', categories.some(c => c.key === state.categoryKey) ? categories : columns, state.categoryKey);
  setSelectOptions('value-select', values.some(c => c.key === state.valueKey) ? values : columns, state.valueKey);
  setSelectOptions('date-select', [{ key: '', name: 'не используется' }, ...columns.filter(column => column.type === 'date')], state.dateKey);
}

function showErrors(errors = [], warnings = []) {
  const node = $('data-errors');
  const messages = [...errors, ...warnings.slice(0, 2)].map(issue => issue.message);
  node.hidden = !messages.length;
  node.textContent = messages.slice(0, 3).join(' ');
  node.dataset.level = errors.length ? 'error' : 'warning';
}

function setRenderStatus(message) { $('render-status').textContent = message; }

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, serializeDraft(state));
    $('draft-status').textContent = tableDirty ? 'изменения таблицы ещё не применены' : 'черновик сохранён в браузере';
  } catch { $('draft-status').textContent = 'браузер не смог сохранить черновик'; }
}

function render() {
  if (!state.dataset) return;
  refreshColumns();
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.size = state.size;
  for (const [id, key] of [['title-input', 'title'], ['caption-input', 'caption'], ['unit-input', 'unit'], ['mode-select', 'mode'], ['order-select', 'order'], ['theme-select', 'theme'], ['size-select', 'size'], ['summary-select', 'summary']]) {
    if ($(id).value !== state[key]) $(id).value = state[key];
  }
  $('missing-toggle').checked = state.showMissing;
  $('stage-size').textContent = state.size === 'stories' ? '1080 × 1920' : '1200 × 900';
  $('postcard-stage').setAttribute('aria-label', state.size === 'stories' ? 'открытка 1080 на 1920' : 'открытка 1200 на 900');
  state.svg = buildScene({ rows: rowsForRender(), state, dataset: state.dataset, themeName: state.theme });
  $('postcard-preview').outerHTML = state.svg.replace('<svg ', '<svg id="postcard-preview" class="postcard-preview" ');
  $('postcard-paper').dataset.theme = state.theme;
  const theme = THEMES[state.theme];
  [...$('palette-preview').children].forEach((node, index) => { node.style.background = [theme.paper, theme.accent, theme.ink, theme.accentAlt][index]; });
  $('sample-select').value = state.sample;
  ['export-png', 'export-svg', 'export-html'].forEach(id => { $(id).disabled = false; });
  const needsDate = ['calendar', 'timeline'].includes(state.mode) && !state.dateKey;
  const hasNumbers = state.dataset.rows.some(row => parseNumber(row[state.valueKey]) !== null);
  setRenderStatus(needsDate ? 'выберите колонку дат в оформлении' : !hasNumbers && state.mode !== 'calendar' ? 'в выбранной колонке нет чисел' : 'открытка готова');
  saveDraft();
}

function updateTableActions() {
  const count = $('table-body').rows.length;
  $('data-summary').textContent = `${count} ${count >= 5 ? 'строк' : 'строки'}`;
  $('add-row').disabled = count >= MAX_ROWS;
  document.querySelectorAll('.delete-row').forEach(button => { button.disabled = count <= MIN_ROWS; });
  [...$('table-body').rows].forEach((row, index) => {
    row.querySelectorAll('input').forEach((input, col) => input.setAttribute('aria-label', `строка ${index + 1}, колонка ${col + 1}`));
    row.querySelector('.delete-row').setAttribute('aria-label', `удалить строку ${index + 1}`);
  });
}

function addTableRow(cells = []) {
  const columns = $('table-head').querySelectorAll('input').length;
  const row = document.createElement('tr');
  row.innerHTML = Array.from({ length: columns }, (_, index) => `<td><input type="text" value="${esc(cells[index])}" autocomplete="off" /></td>`).join('') + '<td class="delete-cell"><button class="delete-row" type="button" title="удалить строку">×</button></td>';
  $('table-body').append(row);
  updateTableActions();
  return row;
}

function renderTable() {
  $('table-head').innerHTML = `<tr>${state.dataset.headers.map((header, index) => `<th scope="col"><input type="text" value="${esc(header)}" aria-label="название колонки ${index + 1}" autocomplete="off" /></th>`).join('')}<th class="delete-cell"><span class="visually-hidden">удаление</span></th></tr>`;
  $('table-body').replaceChildren();
  (state.dataset.rawRows || state.dataset.rows).forEach(row => addTableRow(state.dataset.headers.map(header => row[header])));
}

function loadDataset(dataset, meta = {}) {
  if (!canActivateDataset(dataset)) return false;
  tableDirty = false;
  importRequest += 1;
  state.dataset = dataset;
  state.sourceLabel = meta.sourceLabel || 'ваши данные';
  state.sample = meta.sample || '';
  state.title = meta.title ?? 'ваши данные';
  state.caption = meta.caption ?? '';
  state.unit = meta.unit ?? '';
  state.mode = meta.mode || chooseDefaultMode(dataset.columns);
  state.summary = meta.summary || (state.mode === 'timeline' ? 'average' : 'total');
  state.order = meta.order || 'input';
  state.theme = meta.theme || state.theme;
  state.size = meta.size || state.size;
  state.showMissing = meta.showMissing !== false;
  state.categoryKey = meta.categoryKey || dataset.columns.find(column => column.type === 'category')?.key || dataset.headers[0];
  state.valueKey = meta.valueKey || dataset.columns.find(column => column.type === 'number')?.key || dataset.headers[1] || dataset.headers[0];
  state.dateKey = meta.dateKey ?? dataset.columns.find(column => column.type === 'date')?.key ?? '';
  showErrors(meta.errors || dataset.errors || [], meta.warnings || dataset.warnings || []);
  renderTable();
  render();
  return true;
}

function loadSample(name) {
  const sample = SAMPLES[name] || SAMPLES.reading;
  const { dataset } = datasetFromTable(sample.headers, sample.rows);
  loadDataset(dataset, { ...sample, sample: name, sourceLabel: `пример: ${sample.title}` });
}

function applyTable() {
  const headers = [...$('table-head').querySelectorAll('input')].map(input => input.value);
  const rows = [...$('table-body').rows].map(row => [...row.querySelectorAll('input')].map(input => input.value));
  const result = datasetFromTable(headers, rows);
  if (!result.dataset) { showErrors(result.errors, result.warnings); setRenderStatus('проверьте таблицу · предыдущая открытка сохранена'); return; }
  loadDataset(result.dataset, { ...state, sample: '', sourceLabel: 'ваши данные', errors: result.errors, warnings: result.warnings });
}

async function readFile(file) {
  const request = ++importRequest;
  const policyError = fileImportError(file);
  if (policyError) { showErrors([{ message: policyError }]); $('file-input').value = ''; return; }
  try {
    const parsed = parseText(await file.text(), file.name, { source: 'file' });
    if (request !== importRequest) return;
    if (!parsed.dataset) { showErrors(parsed.errors, parsed.warnings); setRenderStatus('проверьте файл · предыдущая открытка сохранена'); return; }
    loadDataset(parsed.dataset, { sourceLabel: file.name, title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '), errors: parsed.errors, warnings: parsed.warnings });
  } catch {
    if (request === importRequest) showErrors([{ message: 'не удалось прочитать файл. выберите csv или json до 1 мб.' }]);
  } finally { if (request === importRequest || request + 1 === importRequest) $('file-input').value = ''; }
}

function handlePaste() {
  importRequest += 1;
  const text = $('paste-input').value.trim();
  const parsed = parseText(text, { source: 'paste' });
  if (!parsed.dataset) { showErrors(parsed.errors, parsed.warnings); setRenderStatus('проверьте строки · предыдущая открытка сохранена'); return; }
  loadDataset(parsed.dataset, { sourceLabel: 'вставленные строки', errors: parsed.errors, warnings: parsed.warnings });
}

function selectTab(tab) {
  document.querySelectorAll('[role="tab"]').forEach(button => {
    const selected = button === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(button.getAttribute('aria-controls')).hidden = !selected;
  });
}

function bind() {
  [['title-input', 'title'], ['caption-input', 'caption'], ['unit-input', 'unit']].forEach(([id, key]) => $(id).addEventListener('input', event => { state[key] = event.target.value; render(); }));
  [['mode-select', 'mode'], ['order-select', 'order'], ['theme-select', 'theme'], ['size-select', 'size'], ['summary-select', 'summary'], ['category-select', 'categoryKey'], ['value-select', 'valueKey'], ['date-select', 'dateKey']].forEach(([id, key]) => $(id).addEventListener('change', event => { state[key] = event.target.value; render(); }));
  $('missing-toggle').addEventListener('change', event => { state.showMissing = event.target.checked; render(); });
  $('sample-select').addEventListener('change', event => { if (SAMPLES[event.target.value]) loadSample(event.target.value); });
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[next]); tabs[next].focus();
    });
  });
  const markTableDirty = () => { tableDirty = true; $('draft-status').textContent = 'изменения таблицы ещё не применены'; };
  $('data-table').addEventListener('input', markTableDirty);
  $('add-row').addEventListener('click', () => { if ($('table-body').rows.length < MAX_ROWS) { addTableRow().querySelector('input').focus(); markTableDirty(); } });
  $('table-body').addEventListener('click', event => {
    const button = event.target.closest('.delete-row');
    if (button && $('table-body').rows.length > MIN_ROWS) { const row = button.closest('tr'); const focusRow = row.nextElementSibling || row.previousElementSibling; row.remove(); updateTableActions(); focusRow?.querySelector('input').focus(); markTableDirty(); }
  });
  $('apply-table').addEventListener('click', applyTable);
  const dropZone = $('drop-zone'); const fileInput = $('file-input'); const openPicker = () => fileInput.click();
  $('import-button').addEventListener('click', openPicker);
  dropZone.addEventListener('click', openPicker);
  dropZone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); } });
  ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
  dropZone.addEventListener('drop', event => { if (event.dataTransfer.files?.[0]) readFile(event.dataTransfer.files[0]); });
  fileInput.addEventListener('change', () => { if (fileInput.files?.[0]) readFile(fileInput.files[0]); });
  $('paste-button').addEventListener('click', handlePaste);
  $('reset-draft').addEventListener('click', () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} Object.assign(state, { theme: 'paper', size: 'landscape', showMissing: true }); $('paste-input').value = ''; document.querySelectorAll('details').forEach(detail => { detail.open = false; }); loadSample('reading'); selectTab($('tab-data')); });
  for (const format of ['png', 'svg', 'html']) $('export-' + format).addEventListener('click', async () => {
    const button = $('export-' + format);
    button.disabled = true;
    try {
      const filename = `${sanitizeFilename(state.title)}.${format}`;
      if (format === 'png') await exportPng(state.svg, state.size === 'stories' ? 1080 : 1200, state.size === 'stories' ? 1920 : 900, filename);
      else if (format === 'svg') exportSvg(state.svg, filename);
      else exportStandaloneHtml(state.svg, state.title, filename, JSON.parse(serializeDraft(state)));
      setRenderStatus(`файл ${format} готов`);
    } catch { setRenderStatus(`не удалось сохранить ${format}. попробуйте ещё раз.`); }
    finally { button.disabled = false; }
  });
}

function init() {
  bind();
  let draft = null;
  try { draft = readDraft(localStorage.getItem(DRAFT_KEY)); } catch {}
  if (draft) { loadDataset(draft.dataset, draft); setRenderStatus('ваш черновик восстановлен'); }
  else loadSample('reading');
}

init();
window.DataPostcard = { state, samples: SAMPLES, render, loadSample, loadDataset };
