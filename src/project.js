import { DRAFT_CHOICES, readDraft, serializeDraft } from './editor.js';
import { MAX_FILE_BYTES } from './app-state.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCell = value => value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value));
const textKeys = ['title', 'caption', 'unit', 'categoryKey', 'valueKey', 'dateKey', 'sourceLabel', 'sample'];
const failure = error => ({ project: null, error });

/** Read a portable postcard without changing any live editor state. */
export function readProject(text) {
  if (typeof text !== 'string') return failure('не удалось прочитать файл открытки.');
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) return failure('файл слишком большой: максимум 1 мб.');
  let saved;
  try { saved = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { return failure('json повреждён. выберите файл, сохранённый через «сохранить черновик».'); }
  if (!isRecord(saved) || saved.type !== 'data-postcard') return failure('это не файл открытки. csv и json с данными можно загрузить в разделе выше.');
  if (saved.version !== 1) return failure('эта версия файла открытки пока не поддерживается.');

  const damaged = 'файл открытки содержит неверные данные или настройки. предыдущая открытка сохранена.';
  if (!Array.isArray(saved.headers) || !saved.headers.length || !saved.headers.every(header => typeof header === 'string' && header === header.trim()) || !Array.isArray(saved.rows) || !isRecord(saved.settings)) return failure(damaged);
  // Reject malformed rows before the draft reader could pad or discard cells.
  const headers = saved.headers;
  if (!saved.rows.every(row => {
    if (Array.isArray(row)) return row.length === headers.length && row.every(isCell);
    return isRecord(row) && Object.keys(row).length === headers.length && headers.every(header => Object.hasOwn(row, header) && isCell(row[header]));
  })) return failure(damaged);
  if (Object.entries(DRAFT_CHOICES).some(([key, allowed]) => Object.hasOwn(saved.settings, key) && !allowed.includes(saved.settings[key]))) return failure(damaged);
  if (textKeys.some(key => Object.hasOwn(saved.settings, key) && (typeof saved.settings[key] !== 'string' || saved.settings[key].length > 2000))) return failure(damaged);
  if (Object.hasOwn(saved.settings, 'showMissing') && typeof saved.settings.showMissing !== 'boolean') return failure(damaged);
  const project = readDraft(JSON.stringify(saved));
  if (!project) return failure(damaged);
  for (const key of ['categoryKey', 'valueKey', 'dateKey']) {
    if (project[key] && !headers.includes(project[key])) return failure(damaged);
  }
  return { project, error: '' };
}

export function serializeProject(state) {
  const saved = { type: 'data-postcard', ...JSON.parse(serializeDraft(state)) };
  const text = JSON.stringify(saved);
  const { error } = readProject(text);
  if (error) throw new Error(error);
  return text;
}

export function projectFileError(file) {
  if (!file || typeof file.name !== 'string' || !file.name.toLowerCase().endsWith('.json')) return 'выберите файл открытки в формате json.';
  if (file.size > MAX_FILE_BYTES) return 'файл слишком большой: максимум 1 мб.';
  return '';
}
