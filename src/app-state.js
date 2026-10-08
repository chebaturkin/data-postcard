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

/** Return whether an imported dataset is safe to replace the active one with. */
export function canActivateDataset(dataset) {
  return Boolean(
    dataset
      && dataset.valid === true
      && Array.isArray(dataset.rows)
      && dataset.rows.length > 0
  );
}

export default {
  chooseDefaultMode,
  modeLabel,
  sourceLabel,
  canActivateDataset
};
