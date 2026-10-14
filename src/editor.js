import { validateDataset } from './data.js';

export const DRAFT_KEY = 'data-postcard-draft-v1';

export function datasetFromTable(headers, rows) {
  const validated = validateDataset(headers, rows);
  return { dataset: validated.valid ? validated : null, errors: validated.errors, warnings: validated.warnings };
}

/** Map file-style validation coordinates to editable table fields. */
export function tableErrorCells(headers, errors = []) {
  const labels = headers.map(header => String(header ?? '').replace(/^\uFEFF/, '').trim());
  return errors.flatMap(error => {
    let rowIndex = null;
    let columnIndex = -1;
    if (['invalid-number', 'invalid-date'].includes(error.code) && Number.isInteger(error.row) && error.row >= 2) {
      rowIndex = error.row - 2;
      columnIndex = labels.indexOf(error.column);
    } else if (error.code === 'missing-header' && Number.isInteger(error.column)) columnIndex = error.column - 1;
    else if (error.code === 'duplicate-header' && Number.isInteger(error.index)) columnIndex = error.index - 1;
    if (columnIndex < 0 || columnIndex >= labels.length) return [];
    const message = rowIndex === null ? error.message : error.message.replace(/^строка \d+/, `строка ${rowIndex + 1}`);
    return [{ rowIndex, columnIndex, message }];
  });
}

export const DRAFT_CHOICES = {
  mode: ['bars', 'dots', 'calendar', 'timeline'],
  order: ['input', 'ascending', 'descending'],
  theme: ['paper', 'night', 'court', 'archive', 'ink'],
  size: ['landscape', 'stories'],
  summary: ['total', 'average', 'none'],
};

export function serializeDraft(state) {
  const settings = {};
  for (const key of [...Object.keys(DRAFT_CHOICES), 'title', 'caption', 'unit', 'categoryKey', 'valueKey', 'dateKey', 'sourceLabel', 'sample', 'showMissing']) settings[key] = state[key];
  const text = JSON.stringify({ version: 1, headers: state.dataset.headers, rows: state.dataset.rawRows || state.dataset.rows, settings, pendingTable: state.pendingTable });
  if (new TextEncoder().encode(text).byteLength > 1024 * 1024) throw new Error('черновик слишком большой: максимум 1 мб.');
  return text;
}

export function readDraft(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > 1024 * 1024) return null;
  try {
    const saved = JSON.parse(text);
    if (saved?.version !== 1 || !Array.isArray(saved.headers) || !Array.isArray(saved.rows)) return null;
    const { dataset } = datasetFromTable(saved.headers, saved.rows);
    if (!dataset) return null;
    const settings = saved.settings || {};
    const result = { dataset, showMissing: settings.showMissing !== false };
    for (const [key, allowed] of Object.entries(DRAFT_CHOICES)) result[key] = allowed.includes(settings[key]) ? settings[key] : allowed[0];
    for (const key of ['title', 'caption', 'unit', 'categoryKey', 'valueKey', 'dateKey', 'sourceLabel', 'sample']) result[key] = typeof settings[key] === 'string' ? settings[key].slice(0, 2000) : '';
    const pending = saved.pendingTable;
    if (pending && Array.isArray(pending.headers) && pending.headers.length > 0 && pending.headers.every(cell => typeof cell === 'string') && Array.isArray(pending.rows) && pending.rows.length >= 2 && pending.rows.length <= 20 && pending.rows.every(row => Array.isArray(row) && row.length === pending.headers.length && row.every(cell => typeof cell === 'string'))) {
      result.pendingTable = pending;
    } else if (pending !== undefined) return null;
    return result;
  } catch { return null; }
}
