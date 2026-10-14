import { t, getLocale, localeTag, mountLocale, translateMessage, setLocale } from '../i18n.js';
import { parseText, inferColumns, parseNumber, MIN_ROWS, MAX_ROWS } from './data.js';
import { buildScene, sceneDiagnostics } from './scene.js';
import { THEMES } from './themes.js';
import { SAMPLES, sampleForLocale } from './samples.js';
import { datasetFromTable, tableErrorCells, serializeDraft, readDraft, DRAFT_KEY } from './editor.js';
import { exportSvg, exportPng, exportStandaloneHtml, sanitizeFilename, downloadBlob } from './export.js';
import { serializeProject, readProject, projectFileError } from './project.js';
import { filterMissingRows, chooseDefaultMode, canActivateDataset, sortRowsForDisplay, fileImportError } from './app-state.js';
import { animate, cancelMotion, feedback, renderPreview } from './motion.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
const state = { title: '', caption: '', unit: '', mode: 'bars', summary: 'total', order: 'input', theme: 'paper', size: 'landscape', showMissing: true, categoryKey: '', valueKey: '', dateKey: '', sourceLabel: '', dataset: null, sample: '', svg: '' };
let importRequest = 0;
let tableDirty = false;
let undoSnapshot = null;
let restoring = false;
let exportable = true;
let draftSaved = false;
const busyExports = new Set();
let activeBuiltin = false;
let displayedIssues = { errors: [], warnings: [] };

function rowsForRender() {
  const rows = filterMissingRows(state.dataset.rows, state.valueKey, state.showMissing);
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
  setSelectOptions('date-select', [{ key: '', get name() { return t("s0"); } }, ...columns.filter(column => column.type === 'date')], state.dateKey);
}

function showErrors(errors = [], warnings = []) {
  displayedIssues = { errors, warnings };
  const node = $('data-errors');
  const messages = errors.map(issue => issue.message);
  const warningNode = $('data-warnings');
  warningNode.hidden = !warnings.length;
  warningNode.textContent = warnings.slice(0, 3).map(issue => issue.message).join(' ');
  node.hidden = !messages.length;
  node.textContent = messages.slice(0, 3).join(' ');
  node.dataset.level = errors.length ? 'error' : 'warning';
}

function setRenderStatus(message, level = 'neutral') {
  cancelMotion($('status-mark'));
  $('render-message').textContent = message;
  $('render-status').dataset.level = level;
  if (level === 'success') animate($('status-mark'), [
    { transform: 'scale(1.35) rotate(-22deg)', opacity: .3 },
    { transform: 'scale(.95) rotate(-8deg)', opacity: 1, offset: .65 },
    { transform: 'rotate(-8deg)', opacity: 1 },
  ], 'paper');
}

function clearCellError(input) {
  input.removeAttribute('aria-invalid');
  input.removeAttribute('aria-describedby');
  input.removeAttribute('title');
  input.parentElement.querySelector('.cell-error')?.remove();
}

function clearTableErrors() {
  $('data-table').querySelectorAll('[aria-invalid]').forEach(clearCellError);
}

function showTableErrors(headers, errors, warnings) {
  if ($('postcard-viewer').open) $('postcard-viewer').close();
  clearTableErrors();
  showErrors(errors.map(error => ({ ...error, message: Number.isInteger(error.row) ? error.message.replace(/^(?:строка|row) \d+/, t("s1", { p0: error.row - 1 })) : error.message })), warnings.map(warning => ({ ...warning, message: Number.isInteger(warning.row) ? warning.message.replace(/^(?:строка|row) \d+/, t("s1", { p0: warning.row - 1 })) : warning.message })));
  for (const { rowIndex, columnIndex, message } of tableErrorCells(headers, errors)) {
    const row = rowIndex === null ? $('table-head').rows[0] : $('table-body').rows[rowIndex];
    const input = row?.querySelectorAll('input')[columnIndex];
    if (!input) continue;
    const description = document.createElement('span');
    description.className = 'visually-hidden cell-error';
    description.id = `cell-error-${rowIndex === null ? 'header' : rowIndex}-${columnIndex}`;
    description.textContent = message;
    input.parentElement.append(description);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', description.id);
    input.title = message;
  }
  selectTab($('tab-data'));
  $('data-table').querySelector('[aria-invalid="true"]')?.focus();
}

function capturePendingTable() {
  return { headers: [...$('table-head').querySelectorAll('input')].map(input => input.value), rows: [...$('table-body').rows].map(row => [...row.querySelectorAll('input')].map(input => input.value)) };
}

function rememberReplacement() {
  if (!state.dataset || restoring) return true;
  try { undoSnapshot = serializeDraft({ ...state, pendingTable: tableDirty ? capturePendingTable() : undefined }); }
  catch { showErrors([{get message() { return t("s2"); }}]); return false; }
  $('undo-source').hidden = false;
  return true;
}

function saveDraft() {
  state.pendingTable = tableDirty ? capturePendingTable() : undefined;
  $('table-status').hidden = !tableDirty;
  $('table-status').textContent = t("s3");

  try {
    localStorage.setItem(DRAFT_KEY, serializeDraft(state));
    draftSaved = true;
    $('draft-status').textContent = tableDirty ? t("s4") : t("s5");
  } catch { draftSaved = false; $('draft-status').textContent = t("s6"); }
}

function render(effect = 'none') {
  if (!state.dataset) return;
  refreshColumns();
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.size = state.size;
  for (const [id, key] of [['title-input', 'title'], ['caption-input', 'caption'], ['unit-input', 'unit'], ['mode-select', 'mode'], ['order-select', 'order'], ['theme-select', 'theme'], ['size-select', 'size'], ['summary-select', 'summary']]) {
    if ($(id).value !== state[key]) $(id).value = state[key];
  }
  document.querySelectorAll('[name="graph-mode"]').forEach(input => { input.checked = input.value === state.mode; });
  $('missing-toggle').checked = state.showMissing;
  $('stage-size').textContent = state.size === 'stories' ? '1080 × 1920' : '1200 × 900';
  $('postcard-stage').setAttribute('aria-label', state.size === 'stories' ? t("s7") : t("s8"));
  const sceneOptions = { rows: rowsForRender(), state, dataset: state.dataset, themeName: state.theme };
  const diagnostics = sceneDiagnostics(sceneOptions);
  exportable = diagnostics.exportable;
  if (exportable || !state.svg) state.svg = buildScene(sceneOptions);
  $('graph-error').hidden = exportable;
  $('graph-error').textContent = diagnostics.message + t("s9");
  renderPreview(state.svg, effect);
  if ($('postcard-viewer').open) $('viewer-image').innerHTML = viewerMarkup('viewer');
  $('compact-image').innerHTML = viewerMarkup('compact');
  $('postcard-paper').dataset.theme = state.theme;
  const theme = THEMES[state.theme];
  [...$('palette-preview').children].forEach((node, index) => { node.style.background = [theme.paper, theme.accent, theme.ink, theme.accentAlt][index]; });
  $('sample-select').value = state.sample;
  document.querySelectorAll('[data-export]').forEach(button => { button.disabled = !exportable || busyExports.has(button.dataset.export); });
  ['png', 'svg', 'html'].forEach(format => { $('export-' + format).disabled = busyExports.has(format) || !exportable; });
  if (!busyExports.size) setRenderStatus(!exportable ? diagnostics.message + t("s10") : diagnostics.warnings.length ? diagnostics.warnings.join(' ') : t("s11"), !exportable ? 'error' : diagnostics.warnings.length ? 'warning' : 'neutral');
  saveDraft();
}

function updateTableActions() {
  const count = $('table-body').rows.length;
  $('data-summary').textContent = `${count} ${count >= 5 ? t("s12") : t("s13")}`;
  $('add-row').disabled = count >= MAX_ROWS;
  $('table-scroll-hint').hidden = $('table-head').querySelectorAll('input').length <= 2;
  document.querySelectorAll('.delete-row').forEach(button => { button.disabled = count <= MIN_ROWS; });
  [...$('table-body').rows].forEach((row, index) => {
    row.querySelectorAll('input').forEach((input, col) => input.setAttribute('aria-label', t("s14", { p0: index + 1, p1: $('table-head').querySelectorAll('input')[col]?.value || t("s15") + (col + 1) })));
    row.querySelectorAll('input').forEach((input, col) => { input.inputMode = state.dataset?.columns?.[col]?.type === 'number' ? 'decimal' : 'text'; });
    row.querySelector('.delete-row').setAttribute('aria-label', t("s16", { p0: index + 1 }));
  });
}

function addTableRow(cells = []) {
  const columns = $('table-head').querySelectorAll('input').length;
  const row = document.createElement('tr');
  row.innerHTML = Array.from({ length: columns }, (_, index) => `<td><input type="text" value="${esc(cells[index])}" autocomplete="off" /></td>`).join('') + t("s17");
  $('table-body').append(row);
  updateTableActions();
  return row;
}

function renderTable() {
  cancelMotion($('table-body'));
  $('table-head').innerHTML = t("s18", { p0: state.dataset.headers.map((header, index) => t("s19", { p0: esc(header), p1: index + 1 })).join('') });
  $('table-body').replaceChildren();
  (state.dataset.rawRows || state.dataset.rows).forEach(row => addTableRow(state.dataset.headers.map(header => row[header])));
}

function loadDataset(dataset, meta = {}, effect = 'paper') {
  activeBuiltin = false;
  if (!canActivateDataset(dataset)) return false;
  tableDirty = false;
  state.pendingTable = undefined;
  delete $('apply-table').dataset.dirty;
  delete $('apply-table').dataset.feedback;
  cancelPendingImport(true);
  state.dataset = dataset;
  state.sourceLabel = meta.sourceLabel || t("s20");
  state.sample = meta.sample || '';
  state.title = meta.title ?? t("s20");
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
  render(effect);
  return true;
}

function loadSample(name, effect = 'paper') {
  const sample = SAMPLES[name] || SAMPLES.reading;
  const { dataset } = datasetFromTable(sample.headers, sample.rows);
  if (!rememberReplacement()) return;
  loadDataset(dataset, { ...sample, sample: name, sourceLabel: t("s21", { p0: sample.title }) }, effect);
  activeBuiltin = true;
}

function applyTable() {
  const headers = [...$('table-head').querySelectorAll('input')].map(input => input.value);
  const rows = [...$('table-body').rows].map(row => [...row.querySelectorAll('input')].map(input => input.value));
  const result = datasetFromTable(headers, rows);
  if (!result.dataset) { showTableErrors(headers, result.errors, result.warnings); feedback($('apply-table'), 'error'); setRenderStatus(t("s22"), 'error'); return false; }
  loadDataset(result.dataset, { ...state, sample: '', get sourceLabel() { return t("s20"); }, errors: result.errors, warnings: result.warnings.map(issue => ({...issue, message: issue.message.replace(/^(?:строка|row) \d+/, t("s1", { p0: issue.row - 1 }))})) }, 'data');
  feedback($('apply-table'), 'success');
  setRenderStatus(t("s23"), 'success');
  return true;
}

function setImportBusy(busy) {
  $('drop-zone').setAttribute('aria-busy', String(busy));
  $('import-button').setAttribute('aria-busy', String(busy));
  $('drop-zone').querySelector('.drop-zone__title').textContent = busy ? t("s24") : t("s25");
}

function showProjectStatus(message = '', level = 'neutral') {
  const node = $('project-status');
  node.textContent = message;
  node.hidden = !message;
  node.dataset.level = level;
  node.className = level === 'error' ? 'input-error' : 'field-hint';
}

function setProjectBusy(busy) {
  $('open-project').setAttribute('aria-busy', String(busy));
  $('open-project').textContent = busy ? t("s24") : t("s26");
}

function cancelPendingImport(clearStatus = false) {
  importRequest += 1;
  setImportBusy(false);
  if (clearStatus) showProjectStatus();
  else if ($('open-project').getAttribute('aria-busy') === 'true') showProjectStatus(t("s27"));
  setProjectBusy(false);
}

function saveProject() {
  saveDraft();
  cancelPendingImport(true);
  try {
    const text = serializeProject(state);
    downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), `${sanitizeFilename(state.title)}.postcard.json`);
    showProjectStatus(t("s28"));
    feedback($('save-project'), 'success');
  } catch (error) {
    showProjectStatus(error.message.includes(t("s29")) ? error.message : t("s30"), 'error');
  }
}

async function readProjectFile(file) {
  cancelPendingImport(true);
  const request = importRequest;
  $('project-input').value = '';
  const policyError = projectFileError(file);
  if (policyError) { showProjectStatus(policyError, 'error'); return; }
  setProjectBusy(true);
  showProjectStatus(t("s31"));
  try {
    const { project, error } = readProject(await file.text());
    if (request !== importRequest) return;
    if (!project) { showProjectStatus(error, 'error'); return; }
    if (!rememberReplacement()) return;
    loadDataset(project.dataset, project); restorePending(project.pendingTable);
    showProjectStatus(t("s32"));
    setRenderStatus(t("s33"), 'success');
  } catch {
    if (request === importRequest) showProjectStatus(t("s34"), 'error');
  } finally { if (request === importRequest) setProjectBusy(false); }
}

async function readFile(file) {
  cancelPendingImport(true);
  const request = importRequest;
  $('file-input').value = '';
  setImportBusy(false);
  const policyError = fileImportError(file);
  if (policyError) { showErrors([{ message: policyError }]); setRenderStatus(t("s35"), 'error'); return; }
  setImportBusy(true);
  setRenderStatus(t("s24"));
  try {
    const fileText = await file.text();
    if (request !== importRequest) return;
    let candidate;
    try { candidate = JSON.parse(fileText); } catch {}
    if (candidate?.type === 'data-postcard') {
      const { project, error } = readProject(fileText);
      if (!project) { showErrors([{ message: error }]); return; }
      if (!rememberReplacement()) return; loadDataset(project.dataset, project); restorePending(project.pendingTable); showProjectStatus(t("s36")); return;
    }
    const parsed = parseText(fileText, file.name, { source: 'file' });
    if (request !== importRequest) return;
    if (!parsed.dataset) { showErrors(parsed.errors.map(issue => ({...issue, message: issue.message.replace(/^(?:строка|row) /, t("s37"))})), parsed.warnings.map(issue => ({...issue, message: issue.message.replace(/^(?:строка|row) /, t("s37"))}))); setRenderStatus(t("s35"), 'error'); return; }
    if (!rememberReplacement()) return;
    loadDataset(parsed.dataset, { sourceLabel: file.name, title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '), errors: parsed.errors.map(issue => ({...issue, message: issue.message.replace(/^(?:строка|row) /, t("s37"))})), warnings: parsed.warnings.map(issue => ({...issue, message: issue.message.replace(/^(?:строка|row) /, t("s37"))})) });
    setRenderStatus(t("s38"), 'success');
  } catch {
    if (request === importRequest) { showErrors([{ get message() { return t("s39"); } }]); setRenderStatus(t("s40"), 'error'); }
  } finally { if (request === importRequest) setImportBusy(false); }
}

function handlePaste() {
  cancelPendingImport(true);
  const text = $('paste-input').value.trim();
  const parsed = parseText(text, { source: 'paste' });
  if (!parsed.dataset) { showErrors(parsed.errors.map(issue => ({...issue, message: issue.message.replace(/^(?:строка|row) /, t("s37"))})), parsed.warnings.map(issue => ({...issue, message: issue.message.replace(/^(?:строка|row) /, t("s37"))}))); feedback($('paste-button'), 'error'); setRenderStatus(t("s41"), 'error'); return; }
  if (!rememberReplacement()) return;
  loadDataset(parsed.dataset, { get sourceLabel() { return t("s42"); }, errors: parsed.errors, warnings: parsed.warnings.map(issue => ({...issue, message: Number.isInteger(issue.row) ? issue.message.replace(/^(?:строка|row) \d+/, t("s1", { p0: issue.row - 1 })) : issue.message})) });
  feedback($('paste-button'), 'success');
  setRenderStatus(t("s43"), 'success');
}

function positionTabIndicator() {
  const tab = document.querySelector('[role="tab"][aria-selected="true"]');
  const indicator = $('tab-indicator');
  indicator.style.width = `${tab.getBoundingClientRect().width}px`;
  indicator.style.left = `${tab.offsetLeft}px`;
}

function selectTab(tab) {
  if (tab.getAttribute('aria-selected') === 'true') return;
  const previous = document.querySelector('[role="tab"][aria-selected="true"]');
  const indicator = $('tab-indicator');
  const oldTab = indicator.getBoundingClientRect().width ? indicator.getBoundingClientRect() : previous?.getBoundingClientRect();
  document.querySelectorAll('.tab-panel').forEach(cancelMotion);
  document.querySelectorAll('[role="tab"]').forEach(button => {
    const selected = button === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(button.getAttribute('aria-controls')).hidden = !selected;
  });
  const newTab = tab.getBoundingClientRect();
  positionTabIndicator();
  if (oldTab) animate(indicator, [{ transform: `translateX(${oldTab.left - newTab.left}px) scaleX(${oldTab.width / newTab.width})` }, { transform: 'none' }]);
  animate($(tab.getAttribute('aria-controls')), [{ opacity: .5, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], 'panel');
}

function bind() {
  window.addEventListener('resize', () => { cancelMotion($('tab-indicator')); positionTabIndicator(); });
  [['title-input', 'title'], ['caption-input', 'caption'], ['unit-input', 'unit']].forEach(([id, key]) => $(id).addEventListener('input', event => { cancelPendingImport(); state[key] = event.target.value; render(); }));
  [['mode-select', 'mode'], ['order-select', 'order'], ['theme-select', 'theme'], ['size-select', 'size'], ['summary-select', 'summary'], ['category-select', 'categoryKey'], ['value-select', 'valueKey'], ['date-select', 'dateKey']].forEach(([id, key]) => $(id).addEventListener('change', event => { cancelPendingImport(); state[key] = event.target.value; render(key === 'mode' ? 'ink' : key === 'theme' ? 'palette' : key === 'size' ? 'format' : 'data'); }));
  document.querySelectorAll('[name="graph-mode"]').forEach(input => input.addEventListener('change', () => { if (input.checked) { cancelPendingImport(); state.mode = input.value; render('ink'); } }));
  $('missing-toggle').addEventListener('change', event => { cancelPendingImport(); state.showMissing = event.target.checked; render('data'); });
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
  const markTableDirty = event => {
    cancelPendingImport();
    tableDirty = true;
    if (event?.target.matches('td input')) clearCellError(event.target);
    else clearTableErrors();
    delete $('apply-table').dataset.feedback;
    $('apply-table').dataset.dirty = 'true';
    saveDraft();
  };
  $('data-table').addEventListener('input', markTableDirty);
  $('add-row').addEventListener('click', () => { if ($('table-body').rows.length < MAX_ROWS) {
    const row = addTableRow();
    row.querySelector('input').focus();
    animate(row, [{ opacity: .4, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'none' }]);
    markTableDirty();
  } });
  $('table-body').addEventListener('click', event => {
    const button = event.target.closest('.delete-row');
    if (button && $('table-body').rows.length > MIN_ROWS) { const row = button.closest('tr'); const focusRow = row.nextElementSibling || row.previousElementSibling; cancelMotion(row); row.remove(); updateTableActions(); focusRow?.querySelector('input').focus(); animate(focusRow, [{ opacity: .55 }, { opacity: 1 }]); markTableDirty(); }
  });
  $('apply-table').addEventListener('click', applyTable);
  const dropZone = $('drop-zone'); const fileInput = $('file-input'); const openPicker = () => fileInput.click();
  $('import-button').addEventListener('click', openPicker);
  dropZone.addEventListener('click', openPicker);
  dropZone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); } });
  let dragDepth = 0;
  const clearDrag = () => { dragDepth = 0; dropZone.classList.remove('is-dragging'); };
  dropZone.addEventListener('dragenter', event => {
    if (![...event.dataTransfer?.types || []].includes('Files')) return;
    event.preventDefault(); dragDepth += 1; dropZone.classList.add('is-dragging');
  });
  dropZone.addEventListener('dragover', event => {
    if (![...event.dataTransfer?.types || []].includes('Files')) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
  });
  dropZone.addEventListener('dragleave', event => { event.preventDefault(); if (--dragDepth <= 0) clearDrag(); });
  dropZone.addEventListener('drop', event => { event.preventDefault(); clearDrag(); if (event.dataTransfer.files?.[0]) readFile(event.dataTransfer.files[0]); });
  document.addEventListener('dragend', clearDrag);
  window.addEventListener('blur', clearDrag);
  $('import-details').addEventListener('toggle', () => { if (!$('import-details').open) clearDrag(); });
  fileInput.addEventListener('change', () => { if (fileInput.files?.[0]) readFile(fileInput.files[0]); });
  $('paste-button').addEventListener('click', handlePaste);
  $('save-project').addEventListener('click', saveProject);
  $('open-project').addEventListener('click', () => $('project-input').click());
  $('project-input').addEventListener('change', () => { if ($('project-input').files?.[0]) readProjectFile($('project-input').files[0]); });
  $('show-import').addEventListener('click', () => { selectTab($('tab-data')); $('import-details').open = true; $('paste-input').focus(); });
  $('undo-source').addEventListener('click', () => {
    if (!undoSnapshot) return;
    const draft = readDraft(undoSnapshot); undoSnapshot = null; $('undo-source').hidden = true;
    if (!draft) return;
    restoring = true; loadDataset(draft.dataset, draft); restorePending(draft.pendingTable); restoring = false;
    setRenderStatus(t("s44"));
  });
  $('view-postcard').addEventListener('click', openViewer);
  $('compact-view').addEventListener('click', openViewer);
  $('viewer-scale').addEventListener('change', event => { $('viewer-image').dataset.scale = event.target.value; });
  document.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => $('export-' + button.dataset.export).click()));
  $('close-viewer').addEventListener('click', () => $('postcard-viewer').close());
  window.addEventListener('beforeunload', event => { if (tableDirty && !draftSaved) { event.preventDefault(); event.returnValue = ''; } });
  $('reset-draft').addEventListener('click', () => { if (!rememberReplacement()) return; restoring = true; try { localStorage.removeItem(DRAFT_KEY); } catch {} Object.assign(state, { theme: 'paper', size: 'landscape', showMissing: true }); $('paste-input').value = ''; document.querySelectorAll('details').forEach(detail => { detail.open = detail.classList.contains('column-details'); }); loadSample('reading'); restoring = false; selectTab($('tab-data')); });
  for (const format of ['png', 'svg', 'html']) $('export-' + format).addEventListener('click', async () => {
    const button = $('export-' + format);
    if (busyExports.has(format)) return;
    if (tableDirty && !applyTable()) return;
    if (!exportable) return;
    busyExports.add(format);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    delete button.dataset.feedback;
    setRenderStatus(t("s45", { p0: format }));
    try {
      const filename = `${sanitizeFilename(state.title)}.${format}`;
      if (format === 'png') await exportPng(state.svg, state.size === 'stories' ? 1080 : 1200, state.size === 'stories' ? 1920 : 900, filename);
      else if (format === 'svg') exportSvg(state.svg, filename);
      else exportStandaloneHtml(state.svg, state.title, filename, JSON.parse(serializeDraft(state)));
      feedback(button, 'success');
      setRenderStatus(t("s46", { p0: format }), 'success');
    } catch { feedback(button, 'error'); setRenderStatus(t("s47", { p0: format }), 'error'); }
    finally { busyExports.delete(format); button.disabled = !exportable; button.setAttribute('aria-busy', 'false'); }
  });
}

function restorePending(pending) {
  if (!pending) return;
  $('table-head').innerHTML = t("s18", { p0: pending.headers.map((header,index) => t("s48", { p0: esc(header), p1: index+1 })).join('') });
  $('table-body').replaceChildren(); pending.rows.forEach(addTableRow);
  tableDirty = true; $('apply-table').dataset.dirty = 'true'; saveDraft();
}

function viewerMarkup(prefix) {
  return state.svg.replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`)
    .replace(/aria-labelledby="([^"]+)"/g, (_, ids) => `aria-labelledby="${ids.split(/\s+/).map(id => `${prefix}-${id}`).join(' ')}"`);
}
function openViewer() { $('viewer-scale').value = innerWidth < 1040 ? 'actual' : 'fit'; $('viewer-image').dataset.scale = $('viewer-scale').value; $('viewer-image').innerHTML = viewerMarkup('viewer'); $('postcard-viewer').showModal(); $('close-viewer').focus(); }

function init() {
  bind();
  let draft = null; let saved = null;
  try { saved = localStorage.getItem(DRAFT_KEY); draft = readDraft(saved); } catch {}
  if (draft) { loadDataset(draft.dataset, draft, 'none'); restorePending(draft.pendingTable); setRenderStatus(t("s49")); }
  else { loadSample('reading', 'none'); if (saved) showProjectStatus(t("s50"), 'error'); }
  undoSnapshot = null; $('undo-source').hidden = true;
}

mountLocale(previous => {
  if (activeBuiltin && state.sample) {
    const before = sampleForLocale(state.sample, previous);
    const after = SAMPLES[state.sample];
    const text = Object.fromEntries(['title','caption','unit'].map(field => [field, state[field] === before[field] ? after[field] : state[field]]));
    if (!tableDirty) {
      const indexes = ['categoryKey','valueKey','dateKey'].map(key => [key,before.headers.indexOf(state[key])]);
      const {dataset} = datasetFromTable(after.headers,after.rows);
      const keys = Object.fromEntries(indexes.map(([key,index]) => [key,index < 0 ? state[key] : after.headers[index]]));
      Object.assign(state,{dataset,...text,...keys,sourceLabel:t('s21',{p0:after.title})});
      renderTable();
    } else Object.assign(state,text);
  }
  const messages = ['data-errors','data-warnings','project-status','render-message'];
  const prior = messages.map(id => [id, $(id).textContent, $(id).hidden]);
  const issues = displayedIssues;
  render();
  updateTableActions();
  $('table-head').querySelectorAll('input').forEach((input,index) => input.setAttribute('aria-label',t('columnName',{p0:index+1})));
  document.querySelectorAll('.delete-row').forEach(button => button.title = t('deleteRowLabel'));
  prior.forEach(([id,message,hidden]) => { if(message && (id !== 'render-message' || $('render-status').dataset.level === 'error')) { $(id).textContent = translateMessage(message,previous); $(id).hidden = hidden; } });
  showErrors(issues.errors.map(issue => ({...issue,message:translateMessage(issue.message,previous)})), issues.warnings.map(issue => ({...issue,message:translateMessage(issue.message,previous)})));
  document.querySelectorAll('.cell-error').forEach(node => { node.textContent = translateMessage(node.textContent,previous); const input=node.parentElement.querySelector('input'); if(input) input.title=node.textContent; });
  positionTabIndicator();
});
init();
window.DataPostcard = { state, samples: SAMPLES, render, loadSample, loadDataset };
