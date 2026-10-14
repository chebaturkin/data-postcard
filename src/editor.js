import { validateDataset } from './data.js';

export const DRAFT_KEY = 'data-postcard-draft-v1';

export function datasetFromTable(headers, rows) {
  const validated = validateDataset(headers, rows);
  return { dataset: validated.valid ? validated : null, errors: validated.errors, warnings: validated.warnings };
}

const choices = {
  mode: ['bars', 'dots', 'calendar', 'timeline'],
  order: ['input', 'ascending', 'descending'],
  theme: ['paper', 'night', 'court', 'archive', 'ink'],
  size: ['landscape', 'stories'],
  summary: ['total', 'average', 'none'],
};

export function serializeDraft(state) {
  const settings = {};
  for (const key of [...Object.keys(choices), 'title', 'caption', 'unit', 'categoryKey', 'valueKey', 'dateKey', 'sourceLabel', 'sample', 'showMissing']) settings[key] = state[key];
  return JSON.stringify({ version: 1, headers: state.dataset.headers, rows: state.dataset.rawRows || state.dataset.rows, settings });
}

export function readDraft(text) {
  if (typeof text !== 'string' || text.length > 1024 * 1024) return null;
  try {
    const saved = JSON.parse(text);
    if (saved?.version !== 1 || !Array.isArray(saved.headers) || !Array.isArray(saved.rows)) return null;
    const { dataset } = datasetFromTable(saved.headers, saved.rows);
    if (!dataset) return null;
    const settings = saved.settings || {};
    const result = { dataset, showMissing: settings.showMissing !== false };
    for (const [key, allowed] of Object.entries(choices)) result[key] = allowed.includes(settings[key]) ? settings[key] : allowed[0];
    for (const key of ['title', 'caption', 'unit', 'categoryKey', 'valueKey', 'dateKey', 'sourceLabel', 'sample']) result[key] = typeof settings[key] === 'string' ? settings[key].slice(0, 2000) : '';
    return result;
  } catch { return null; }
}
