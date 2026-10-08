/**
 * Small, dependency-free data parser for Data Postcard.
 *
 * The module deliberately keeps the raw values around. `parseText` returns a
 * validated dataset whose `rows` contain typed values (numbers, ISO date
 * strings, or null for missing values), while `rawRows` contains the values as
 * they appeared in the source file.
 */

const MIN_ROWS = 5;
const MAX_ROWS = 20;

const NUMBER_HINTS = /(?:^|[_\s-])(amount|count|number|num|value|score|rating|total|quantity|qty|minutes?|temperature|temp|height|weight|distance|price|cost|amount|числ|колич|значен|сумм|оценк|минут|температур|круг)/i;
const DATE_HINTS = /(?:^|[_\s-])(date|datetime|timestamp|time|дата|время)/i;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isMissing = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

function issue(code, message, details = {}) {
  return { code, message, ...details };
}

function cleanHeader(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function rowToObject(headers, row) {
  if (Array.isArray(row)) {
    return Object.fromEntries(headers.map((header, index) => [header, index < row.length ? row[index] : '']));
  }
  if (isObject(row)) {
    return Object.fromEntries(headers.map((header) => [header, Object.prototype.hasOwnProperty.call(row, header) ? row[header] : '']));
  }
  return Object.fromEntries(headers.map((header) => [header, '']));
}

function rowLength(row) {
  return Array.isArray(row) ? row.length : (isObject(row) ? Object.keys(row).length : 0);
}

function parseCsvRows(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const matrix = [];
  let row = [];
  let field = '';
  let quoted = false;
  let justClosedQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          justClosedQuote = true;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
      justClosedQuote = false;
    } else if (char === ',') {
      row.push(field);
      field = '';
      justClosedQuote = false;
    } else if (char === '\n') {
      row.push(field);
      matrix.push(row);
      row = [];
      field = '';
      justClosedQuote = false;
    } else if (char === '\r') {
      if (source[index + 1] === '\n') index += 1;
      row.push(field);
      matrix.push(row);
      row = [];
      field = '';
      justClosedQuote = false;
    } else if (justClosedQuote && !/\s/.test(char)) {
      // A character immediately after a closing quote is malformed CSV. Keep
      // the value readable but report it to the caller.
      field += char;
      justClosedQuote = false;
    } else {
      field += char;
      justClosedQuote = false;
    }
  }

  if (quoted) {
    return { matrix, errors: [issue('csv-parse', 'Кавычки в CSV не закрыты.')], malformed: true };
  }

  // The final empty line should not become an extra data row. A row containing
  // several empty cells (",,") is meaningful and is retained.
  if (field.length > 0 || row.length > 0 || (source.length > 0 && !/[\r\n]$/.test(source))) {
    row.push(field);
    matrix.push(row);
  }

  return { matrix, errors: [] };
}

/** Parse a CSV string, retaining source values as strings. */
export function parseCsv(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  if (!source.trim()) return { headers: [], rows: [], rowLengths: [], errors: [issue('empty-file', 'Файл пустой.')], warnings: [] };
  const parsed = parseCsvRows(source);
  const matrix = parsed.matrix;
  if (matrix.length === 0 || matrix.every((cells) => cells.every((value) => String(value).trim() === ''))) {
    return {
      headers: [], rows: [], rowLengths: [], errors: [issue('empty-file', 'Файл пустой.')], warnings: []
    };
  }

  const headers = (matrix[0] ?? []).map(cleanHeader);
  const rows = matrix.slice(1).filter((cells) => !(cells.length === 1 && cells[0] === '' && matrix.length > 2));
  const rowLengths = rows.map((cells) => cells.length);
  const errors = [...parsed.errors];
  const expectedLength = headers.length;
  rows.forEach((cells, index) => {
    if (cells.length !== expectedLength) {
      errors.push(issue(
        'inconsistent-row',
        `Строка ${index + 2}: ожидалось ${expectedLength} значений, найдено ${cells.length}.`,
        { row: index + 2, expected: expectedLength, actual: cells.length }
      ));
    }
  });

  return {
    headers,
    rows: rows.map((cells) => rowToObject(headers, cells)),
    rowLengths,
    errors,
    warnings: []
  };
}

function headersFromObjects(rows) {
  const headers = [];
  const seen = new Set();
  rows.forEach((row) => {
    if (!isObject(row)) return;
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    });
  });
  return headers;
}

/** Parse a JSON array or an object with one array field. */
export function parseJson(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!source) {
    return { headers: [], rows: [], rowLengths: [], errors: [issue('empty-file', 'Файл пустой.')], warnings: [] };
  }

  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    return {
      headers: [], rows: [], rowLengths: [],
      errors: [issue('invalid-json', `JSON не удалось прочитать: ${error.message}`)], warnings: []
    };
  }

  let rows = value;
  const warnings = [];
  if (isObject(value)) {
    const arrayEntries = Object.entries(value).filter(([, candidate]) => Array.isArray(candidate));
    if (arrayEntries.length === 0) {
      return {
        headers: [], rows: [], rowLengths: [],
        errors: [issue('invalid-json-shape', 'JSON должен быть массивом объектов или объектом с массивом строк.')], warnings
      };
    }
    rows = arrayEntries[0][1];
    if (arrayEntries.length > 1) {
      warnings.push(issue('multiple-arrays', `В JSON найдено несколько массивов; использован «${arrayEntries[0][0]}».`, { field: arrayEntries[0][0] }));
    }
  }

  if (!Array.isArray(rows)) {
    return { headers: [], rows: [], rowLengths: [], errors: [issue('invalid-json-shape', 'JSON должен быть массивом объектов.')], warnings };
  }

  const errors = [];
  const objectRows = rows.map((row, index) => {
    if (!isObject(row)) {
      errors.push(issue('invalid-json-row', `Строка ${index + 1}: ожидался объект.`, { row: index + 1 }));
      return {};
    }
    return row;
  });
  const headers = headersFromObjects(objectRows);
  if (headers.length === 0 && objectRows.length > 0) {
    errors.push(issue('missing-header', 'В JSON не найдено ни одной колонки.'));
  }
  const cleanHeaders = headers.map(cleanHeader);
  const cleanedRows = objectRows.map((row) => {
    const cleaned = {};
    headers.forEach((header, index) => { cleaned[cleanHeaders[index]] = row[header]; });
    return cleaned;
  });

  return {
    headers: cleanHeaders,
    rows: cleanedRows.map((row) => rowToObject(cleanHeaders, row)),
    rowLengths: objectRows.map(rowLength),
    errors,
    warnings
  };
}

function asValues(headers, rows, header) {
  return rows.map((row) => {
    if (Array.isArray(row)) return row[headers.indexOf(header)];
    return row?.[header];
  });
}

/**
 * Parse numbers used in compact hand-entered datasets. Both 1,234.5 and
 * 1 234,5 are accepted; a decimal comma is normalized to a decimal point.
 */
export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/[₽$€£%]/g, '').replace(/[\u00A0\u202F\s']/g, '');
  if (!text) return null;
  if (!/^[+-]?(?:\d+|\d*[.,]\d+)(?:[.,]\d+)*$/.test(text)) return null;

  const sign = /^[+-]/.test(text) ? text[0] : '';
  const unsigned = sign ? text.slice(1) : text;
  const commaCount = (unsigned.match(/,/g) || []).length;
  const dotCount = (unsigned.match(/\./g) || []).length;
  let integerPart = unsigned;
  let fractionPart = '';

  if (commaCount && dotCount) {
    // The final separator is the decimal mark; earlier marks are groups.
    const decimal = unsigned.lastIndexOf(',') > unsigned.lastIndexOf('.') ? ',' : '.';
    const decimalIndex = unsigned.lastIndexOf(decimal);
    integerPart = unsigned.slice(0, decimalIndex).replace(/[.,]/g, '');
    fractionPart = unsigned.slice(decimalIndex + 1);
  } else if (commaCount) {
    const groups = unsigned.split(',');
    const allThousands = groups.length > 2 && groups.slice(1).every((part) => part.length === 3)
      || groups.length === 2 && groups[1].length === 3 && groups[0].length <= 3;
    if (allThousands) {
      integerPart = groups.join('');
    } else if (groups.length === 2) {
      integerPart = groups[0];
      fractionPart = groups[1];
    } else {
      return null;
    }
  } else if (dotCount > 1) {
    const groups = unsigned.split('.');
    if (!groups.slice(1).every((part) => part.length === 3)) return null;
    integerPart = groups.join('');
  } else if (dotCount === 1) {
    const decimalIndex = unsigned.indexOf('.');
    integerPart = unsigned.slice(0, decimalIndex);
    fractionPart = unsigned.slice(decimalIndex + 1);
  }

  if (!integerPart) integerPart = '0';
  if (!/^\d+$/.test(integerPart) || (fractionPart && !/^\d+$/.test(fractionPart))) return null;
  const number = Number(`${sign}${integerPart}${fractionPart ? `.${fractionPart}` : ''}`);
  if (!Number.isFinite(number)) return null;
  return negative ? -Math.abs(number) : number;
}

function dateParts(year, month, day) {
  const y = Number(year); const m = Number(month); const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const candidate = new Date(Date.UTC(y, m - 1, d));
  if (candidate.getUTCFullYear() !== y || candidate.getUTCMonth() !== m - 1 || candidate.getUTCDate() !== d) return null;
  return candidate.toISOString().slice(0, 10);
}

/** Parse the common date formats used by the small sample datasets. */
export function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/);
  if (match) return dateParts(match[1], match[2], match[3]);
  match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:$|\s)/);
  if (match) {
    // Day-first is the least surprising interpretation for localized input.
    return dateParts(match[3], match[2], match[1]);
  }
  // English month names are useful for pasted data. Parse them ourselves so
  // the result is independent of the browser's local timezone.
  const monthNames = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
  let monthMatch = text.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!monthMatch) monthMatch = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (monthMatch) {
    const monthToken = monthMatch[1].match(/^[A-Za-z]+$/) ? monthMatch[1] : monthMatch[2];
    const dayToken = monthMatch[1].match(/^[A-Za-z]+$/) ? monthMatch[2] : monthMatch[1];
    const month = monthNames[monthToken.toLowerCase()];
    if (month) return dateParts(monthMatch[3], month, dayToken);
  }
  return null;
}

/** Infer one of category, number, or date for each header. */
export function inferColumns(headers, rows) {
  const safeHeaders = Array.isArray(headers) ? headers.map(cleanHeader) : [];
  return safeHeaders.map((header) => {
    const values = asValues(safeHeaders, Array.isArray(rows) ? rows : [], header);
    const nonEmpty = values.filter((value) => !isMissing(value));
    const numeric = nonEmpty.filter((value) => parseNumber(value) !== null).length;
    const dates = nonEmpty.filter((value) => parseDate(value) !== null).length;
    const dateHint = DATE_HINTS.test(header);
    const numberHint = NUMBER_HINTS.test(header);
    let type = 'category';

    if (dateHint || (dates > 0 && dates === nonEmpty.length) || (dates >= 2 && dates / Math.max(nonEmpty.length, 1) >= 0.6)) {
      type = 'date';
    } else if (numberHint || (numeric > 0 && numeric === nonEmpty.length) || (numeric >= 2 && numeric / Math.max(nonEmpty.length, 1) >= 0.6)) {
      type = 'number';
    }

    return {
      key: header,
      name: header,
      type,
      nonEmpty: nonEmpty.length,
      missing: values.length - nonEmpty.length,
      validNumbers: numeric,
      validDates: dates
    };
  });
}

function duplicateHeaderIssues(headers) {
  const seen = new Map();
  const errors = [];
  headers.forEach((header, index) => {
    const cleaned = cleanHeader(header);
    const key = cleaned.toLocaleLowerCase();
    if (!cleaned) {
      errors.push(issue('missing-header', `Колонка ${index + 1} не имеет названия.`, { column: index + 1 }));
    } else if (seen.has(key)) {
      errors.push(issue('duplicate-header', `Дублирующееся название колонки «${cleaned}».`, { column: cleaned, index: index + 1 }));
    } else {
      seen.set(key, index);
    }
  });
  return errors;
}

/**
 * Validate and type a small dataset. Accepts either (headers, rows) or a
 * parser result object. Errors and warnings are structured for accessible UI
 * messages but remain easy to render as `issue.message`.
 */
export function validateDataset(headersOrDataset, maybeRows) {
  const source = Array.isArray(headersOrDataset)
    ? { headers: headersOrDataset, rows: maybeRows }
    : (headersOrDataset || {});
  const headers = Array.isArray(source.headers) ? source.headers.map(cleanHeader) : [];
  const sourceRows = Array.isArray(source.rows) ? source.rows : [];
  const normalized = normalizeDataset({ headers, rows: sourceRows });
  const errors = [];
  const warnings = [];

  errors.push(...duplicateHeaderIssues(headers));
  const isEmpty = headers.length === 0 && sourceRows.length === 0;
  if (isEmpty) {
    errors.push(issue('empty-file', 'Файл пустой.'));
  } else if (headers.length === 0) {
    errors.push(issue('missing-header', 'Не найдено ни одной колонки.'));
  }

  const rowLengths = Array.isArray(source.rowLengths) ? source.rowLengths : sourceRows.map(rowLength);
  if (headers.length && rowLengths.some((length) => length !== headers.length) && !sourceRows.every(isObject)) {
    rowLengths.forEach((length, index) => {
      if (length !== headers.length) {
        errors.push(issue('inconsistent-row', `Строка ${index + 2}: ожидалось ${headers.length} значений, найдено ${length}.`, { row: index + 2, expected: headers.length, actual: length }));
      }
    });
  }

  if (!isEmpty && sourceRows.length < MIN_ROWS) {
    errors.push(issue('row-count', `Нужно минимум ${MIN_ROWS} строк; найдено ${sourceRows.length}.`, { min: MIN_ROWS, max: MAX_ROWS, actual: sourceRows.length }));
  } else if (sourceRows.length > MAX_ROWS) {
    errors.push(issue('row-count', `Можно использовать максимум ${MAX_ROWS} строк; найдено ${sourceRows.length}.`, { min: MIN_ROWS, max: MAX_ROWS, actual: sourceRows.length }));
  }

  const columns = inferColumns(headers, normalized.rows);
  const typedRows = normalized.rows.map((row, rowIndex) => {
    const typed = {};
    headers.forEach((header) => {
      const original = row[header];
      if (isMissing(original)) {
        typed[header] = null;
        warnings.push(issue('missing-value', `Строка ${rowIndex + 2}, колонка «${header}»: значение пустое.`, { row: rowIndex + 2, column: header }));
        return;
      }
      const column = columns.find((candidate) => candidate.key === header);
      if (column?.type === 'number') {
        const number = parseNumber(original);
        if (number === null) {
          errors.push(issue('invalid-number', `Строка ${rowIndex + 2}, колонка «${header}»: «${String(original)}» не является числом.`, { row: rowIndex + 2, column: header }));
          typed[header] = null;
        } else {
          typed[header] = number;
        }
      } else if (column?.type === 'date') {
        const date = parseDate(original);
        if (date === null) {
          errors.push(issue('invalid-date', `Строка ${rowIndex + 2}, колонка «${header}»: «${String(original)}» не является датой.`, { row: rowIndex + 2, column: header, reason: 'mixed-date' }));
          typed[header] = original;
        } else {
          typed[header] = date;
        }
      } else {
        typed[header] = typeof original === 'string' ? original.trim() : original;
      }
    });
    return typed;
  });

  return {
    headers,
    rows: typedRows,
    rawRows: normalized.rows,
    columns,
    errors,
    warnings,
    valid: errors.length === 0,
    rowCount: sourceRows.length
  };
}

/** Normalize row arrays/objects to objects keyed by the declared headers. */
export function normalizeDataset({ headers = [], rows = [] } = {}) {
  const normalizedHeaders = Array.isArray(headers) ? headers.map(cleanHeader) : [];
  const normalizedRows = (Array.isArray(rows) ? rows : []).map((row) => rowToObject(normalizedHeaders, row));
  return {
    headers: normalizedHeaders,
    rows: normalizedRows,
    rawRows: normalizedRows.map((row) => ({ ...row })),
    rowCount: normalizedRows.length
  };
}

/** Parse, validate and normalize CSV/JSON text based on filename or content. */
export function parseText(text, filename = '') {
  const source = String(text ?? '');
  const extension = String(filename).toLowerCase().split('?')[0].split('#')[0].split('.').pop();
  const trimmed = source.replace(/^\uFEFF/, '').trimStart();
  const parser = extension === 'json' || trimmed.startsWith('{') || trimmed.startsWith('[') ? parseJson : parseCsv;
  const parsed = parser(source);
  const validation = validateDataset({ ...parsed });
  const errors = [...(parsed.errors || []), ...validation.errors.filter((candidate) => !(parsed.errors || []).some((existing) => existing.code === candidate.code && existing.row === candidate.row && existing.column === candidate.column))];
  const warnings = [...(parsed.warnings || []), ...validation.warnings];

  if (errors.some((candidate) => candidate.code === 'invalid-json' || candidate.code === 'invalid-json-shape' || candidate.code === 'csv-parse' || candidate.code === 'empty-file')) {
    return { dataset: null, errors, warnings };
  }

  const dataset = {
    headers: validation.headers,
    rows: validation.rows,
    rawRows: validation.rawRows,
    columns: validation.columns,
    rowCount: validation.rowCount,
    source: filename || 'pasted data',
    valid: validation.valid && errors.length === 0
  };
  return { dataset, errors, warnings };
}

export { MIN_ROWS, MAX_ROWS };

export default {
  parseCsv,
  parseJson,
  parseText,
  inferColumns,
  validateDataset,
  normalizeDataset,
  parseNumber,
  parseDate
};
