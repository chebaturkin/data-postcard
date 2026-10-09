/**
 * Pure helpers used by the controller to choose a useful initial state and
 * keep the visible status copy in Russian.  They deliberately have no DOM or
 * application-state dependency so the controller can be tested independently.
 */

const MODE_LABELS = Object.freeze({
  bars: 'полосы',
  dots: 'точки',
  calendar: 'календарная сетка',
  timeline: 'временной маршрут'
});

const SOURCE_LABELS = Object.freeze({
  'sample reading': 'чтение',
  'sample weather': 'погода',
  'sample sport': 'спорт',
  'pasted data': 'вставленные строки',
  'pasted': 'вставленные строки'
});

export const MAX_FILE_BYTES = 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['csv', 'json']);
const SUPPORTED_MIME_TYPES = new Set(['text/csv', 'application/csv', 'application/json', 'text/json']);

/**
 * Choose a render mode that matches the columns available in a dataset.
 *
 * A timeline needs both a date and a numeric value.  Date-only data can still
 * be laid out as a calendar, while a numeric column without a date is most
 * useful as bars when it has categories and as dots otherwise.
 */
export function chooseDefaultMode(columns = []) {
  const types = new Set(
    (Array.isArray(columns) ? columns : [])
      .map((column) => column?.type)
      .filter(Boolean)
  );

  if (types.has('date') && types.has('number')) return 'timeline';
  if (types.has('date')) return 'calendar';
  if (types.has('number') && types.has('category')) return 'bars';
  if (types.has('number')) return 'dots';
  return 'bars';
}

/** Return the short, user-facing Russian label for a render mode. */
export function modeLabel(mode) {
  return Object.prototype.hasOwnProperty.call(MODE_LABELS, mode)
    ? MODE_LABELS[mode]
    : 'представление';
}

/**
 * Localize built-in source names while retaining useful file names as-is.
 * Empty or non-string values use the same wording as manual input in the UI.
 */
export function sourceLabel(source) {
  const value = typeof source === 'string' ? source.trim() : '';
  if (!value) return 'ввод вручную';
  const normalized = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(SOURCE_LABELS, normalized)
    ? SOURCE_LABELS[normalized]
    : value;
}

/** Return whether a selected file matches the small local import contract. */
export function isSupportedFile(file) {
  if (!file || typeof file.name !== 'string') return false;
  const name = file.name.toLowerCase().split('?')[0].split('#')[0];
  const extension = name.includes('.') ? name.split('.').pop() : '';
  const type = typeof file.type === 'string' ? file.type.toLowerCase().trim() : '';
  return SUPPORTED_EXTENSIONS.has(extension) && (!type || SUPPORTED_MIME_TYPES.has(type));
}

/** Return a user-facing correction for a file that cannot be read safely. */
export function fileImportError(file, maxBytes = MAX_FILE_BYTES) {
  if (!file) return 'выберите CSV или JSON-файл.';
  if (!isSupportedFile(file)) return 'поддерживаются только файлы CSV и JSON.';
  if (Number.isFinite(file.size) && file.size > maxBytes) return 'файл слишком большой: максимум 1 МБ.';
  return '';
}

/** Return whether an imported dataset is safe to replace the active one with. */
export function canActivateDataset(dataset) {
  return Boolean(
    dataset
      && dataset.valid === true
      && Array.isArray(dataset.rows)
      && dataset.rows.length > 0
  );
}

/**
 * Return a stable display order while keeping blank cells at the end. Numeric
 * columns are compared numerically; other values fall back to a locale-aware
 * text comparison. The helper never mutates the dataset rows.
 */
export function sortRowsForDisplay(rows = [], { order = 'input', key = '', parseValue = (value) => value } = {}) {
  const source = Array.isArray(rows) ? rows : [];
  if (!['ascending', 'descending'].includes(order) || !key) return [...source];

  const direction = order === 'ascending' ? 1 : -1;
  return source
    .map((row, index) => ({ row, index, raw: row?.[key], parsed: parseValue(row?.[key]) }))
    .sort((left, right) => {
      const leftMissing = left.raw === null || left.raw === undefined || (typeof left.raw === 'string' && left.raw.trim() === '');
      const rightMissing = right.raw === null || right.raw === undefined || (typeof right.raw === 'string' && right.raw.trim() === '');
      if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;

      const bothNumbers = typeof left.parsed === 'number'
        && Number.isFinite(left.parsed)
        && typeof right.parsed === 'number'
        && Number.isFinite(right.parsed);
      const comparison = bothNumbers
        ? left.parsed - right.parsed
        : String(left.raw ?? '').localeCompare(String(right.raw ?? ''), 'ru', { numeric: true, sensitivity: 'base' });
      return comparison === 0 ? left.index - right.index : comparison * direction;
    })
    .map(({ row }) => row);
}

export default {
  chooseDefaultMode,
  modeLabel,
  sourceLabel,
  canActivateDataset,
  sortRowsForDisplay,
  isSupportedFile,
  fileImportError,
  MAX_FILE_BYTES
};
