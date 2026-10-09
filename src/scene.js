import { parseDate, parseNumber } from './data.js?v=20261009';
import { THEMES } from './themes.js';

const esc = (value) => String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const safeText = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};
const number = (value) => parseNumber(value);
const asDate = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const date = parsed instanceof Date ? parsed : new Date(`${parsed}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
};
const isoDate = (date) => date ? date.toISOString().slice(0, 10) : '';
const ruNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const formatNumber = (value) => value === null || value === undefined || Number.isNaN(value) ? '—' : ruNumber.format(value);
const formatValue = (value, unit = '') => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(value)}${safeText(unit) ? ` ${safeText(unit)}` : ''}`;
};
const russianPlural = (count, one, few, many) => {
  const value = Math.abs(Number(count)) % 100;
  if (value >= 11 && value <= 14) return many;
  const last = value % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
};
const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const dateLabel = (date) => date ? dateFormatter.format(date).replace('.', '') : '';
const monthLabel = (date) => {
  const value = monthFormatter.format(date).replace('.', '');
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const FONT_CSS = `
  .literata { font-family: 'Literata', Georgia, 'Times New Roman', serif; }
  .golos { font-family: 'Golos Text', 'Trebuchet MS', Arial, sans-serif; }
  .mono { font-family: 'Golos Text', 'IBM Plex Mono', Menlo, monospace; font-variant-numeric: tabular-nums; }
`;

function attrs(style = {}) {
  return Object.entries(style).map(([key, value]) => `${key}="${esc(value)}"`).join(' ');
}

function text(x, y, content, style = {}) {
  return `<text x="${x}" y="${y}" ${attrs(style)}>${esc(content)}</text>`;
}

function multilineText(x, y, lines, style = {}, lineHeight = 24) {
  const safeLines = Array.isArray(lines) && lines.length ? lines : [''];
  const tspans = safeLines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`).join('');
  return `<text x="${x}" y="${y}" ${attrs(style)}>${tspans}</text>`;
}

function wrapText(value, maxChars, maxLines = 3) {
  const source = safeText(value);
  if (!source) return [];
  const words = source.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    // Break unusually long pasted words so they cannot run through the page.
    const chunks = word.length > maxChars ? word.match(new RegExp(`.{1,${Math.max(4, maxChars - 1)}}`, 'g')) || [word] : [word];
    chunks.forEach((chunk) => {
      if (!line) line = chunk;
      else if ((line.length + 1 + chunk.length) <= maxChars) line += ` ${chunk}`;
      else { lines.push(line); line = chunk; }
    });
  });
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = `${visible[maxLines - 1].replace(/…$/, '').slice(0, Math.max(1, maxChars - 1))}…`;
  return visible;
}

function shorten(value, maxChars = 22) {
  const source = safeText(value, 'без названия');
  if (source.length <= maxChars) return source;
  return `${source.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function baseDefs(theme) {
  return `<defs>
    <pattern id="missing-hatch" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M-2 2L2 -2M0 10L10 0M8 12L12 8" stroke="${theme.accent}" stroke-width="1" opacity=".45"/>
    </pattern>
    <pattern id="paper-lines" width="36" height="36" patternUnits="userSpaceOnUse">
      <path d="M0 35.5H36" stroke="${theme.ink}" stroke-width=".6" opacity=".035"/>
    </pattern>
  </defs>`;
}

function metricSummary(rows, valueKey, unit) {
  const values = rows.map((row) => number(row?.[valueKey])).filter((value) => value !== null);
  if (!values.length) return '';
  const total = values.reduce((sum, value) => sum + value, 0);
  const mean = total / values.length;
  return { count: values.length, total, mean, unit: safeText(unit) };
}

function renderHeader({ state, theme, width, margin, rows, valueKey, unit }) {
  const stories = width < 1100;
  const summary = metricSummary(rows, valueKey, unit);
  const summaryWidth = stories ? 270 : 250;
  const titleWidth = width - margin * 2 - summaryWidth - 26;
  const titleChars = clamp(Math.floor(titleWidth / (stories ? 27 : 30)), 18, 34);
  const titleLines = wrapText(state.title, titleChars, 2);
  const titleY = stories ? 154 : 112;
  const titleSize = stories ? 58 : 58;
  const titleLineHeight = stories ? 72 : 68;
  const captionChars = clamp(Math.floor((width - margin * 2) / 19), 38, 78);
  const captionLines = wrapText(state.caption, captionChars, stories ? 3 : 2);
  const captionY = titleY + Math.max(1, titleLines.length) * titleLineHeight + 8;
  const captionLineHeight = 25;
  const ruleY = captionY + Math.max(1, captionLines.length) * captionLineHeight + 25;
  const right = width - margin;
  const summaryX = right - summaryWidth;
  let output = multilineText(margin, titleY, titleLines.length ? titleLines : ['без названия'], {
    class: 'literata', fill: theme.ink, 'font-size': titleSize, 'font-weight': 500, 'letter-spacing': '-1.1',
  }, titleLineHeight);
  if (captionLines.length) output += multilineText(margin + 2, captionY, captionLines, {
    class: 'golos', fill: theme.muted, 'font-size': stories ? 19 : 18, 'font-weight': 400,
  }, captionLineHeight);
  if (summary) {
    output += text(summaryX, titleY - 6, `${summary.count} наблюдений`, {
      class: 'golos', fill: theme.muted, 'font-size': 13, 'text-anchor': 'start',
    });
    output += text(right, titleY + 28, `Σ ${formatValue(summary.total, unit)}`, {
      class: 'mono', fill: theme.ink, 'font-size': 20, 'font-weight': 600, 'text-anchor': 'end',
    });
    output += text(right, titleY + 56, `μ ${formatValue(summary.mean, unit)}`, {
      class: 'mono', fill: theme.accent, 'font-size': 15, 'text-anchor': 'end',
    });
  }
  output += `<line x1="${margin}" y1="${ruleY}" x2="${right}" y2="${ruleY}" stroke="${theme.line}" stroke-width="1"/>`;
  if (safeText(unit)) output += text(margin, ruleY + 27, `Единица · ${safeText(unit)}`, {
    class: 'mono', fill: theme.accent, 'font-size': 12, 'letter-spacing': '.6',
  });
  return { markup: output, chartTop: ruleY + (safeText(unit) ? 56 : 35) };
}

function axisTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (Math.abs(max - min) < 1e-9) return [min];
  return Array.from({ length: count + 1 }, (_, index) => min + ((max - min) * index) / count);
}

function renderAxis({ min, max, x1, x2, y, theme, fontSize = 10 }) {
  const ticks = axisTicks(min, max, 4);
  const span = max - min || 1;
  let output = '';
  ticks.forEach((tick, index) => {
    const x = x1 + ((tick - min) / span) * (x2 - x1);
    output += `<line x1="${x}" y1="${y + 9}" x2="${x}" y2="${y + 19}" stroke="${theme.line}" stroke-width="1"/>`;
    output += text(x, y, formatNumber(tick), {
      class: 'mono', fill: theme.muted, 'font-size': fontSize, 'text-anchor': index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : 'middle',
    });
  });
  return output;
}

function renderBars({ rows, categoryKey, valueKey, unit, theme, width, chartTop, chartBottom, margin, state }) {
  const values = rows.map((row) => number(row?.[valueKey]));
  const valid = values.filter((value) => value !== null);
  if (!valid.length) return renderMessage({ theme, width, chartTop, chartBottom, title: 'нет числовых значений', detail: 'выберите числовую колонку или добавьте значения.' });
  const min = Math.min(...valid, 0);
  const max = Math.max(...valid, 0);
  const span = Math.max(max - min, 1);
  const labelWidth = width < 1100 ? 230 : 215;
  const valueWidth = width < 1100 ? 130 : 118;
  const plotLeft = margin + labelWidth;
  const plotRight = width - margin - valueWidth;
  const top = chartTop + 34;
  const bottom = Math.max(top + 20, chartBottom - 10);
  const rowHeight = (bottom - top) / Math.max(rows.length, 1);
  const barHeight = clamp(rowHeight * 0.48, width < 1100 ? 9 : 8, width < 1100 ? 36 : 26);
  const zeroX = plotLeft + ((0 - min) / span) * (plotRight - plotLeft);
  let output = renderAxis({ min, max, x1: plotLeft, x2: plotRight, y: chartTop + 20, theme, fontSize: width < 1100 ? 11 : 10 });
  output += `<line x1="${zeroX}" y1="${top - 5}" x2="${zeroX}" y2="${bottom + 5}" stroke="${theme.ink}" stroke-width="1.2"/>`;
  rows.forEach((row, index) => {
    const value = values[index];
    const y = top + index * rowHeight + (rowHeight - barHeight) / 2;
    const centerY = y + barHeight / 2;
    const category = shorten(row?.[categoryKey] ?? row?.date ?? `строка ${index + 1}`, width < 1100 ? 30 : 26);
    output += `<line x1="${plotLeft}" y1="${centerY}" x2="${plotRight}" y2="${centerY}" stroke="${theme.line}" stroke-width="1" opacity=".65"/>`;
    output += text(margin, centerY + clamp(rowHeight * .26, 5, 8), category, {
      class: 'golos', fill: theme.ink, 'font-size': clamp(rowHeight * .54, 10, 15),
    });
    if (value === null) {
      const missingWidth = clamp(rowHeight * .7, 16, 28);
      output += `<rect x="${zeroX - missingWidth / 2}" y="${y}" width="${missingWidth}" height="${barHeight}" fill="url(#missing-hatch)" stroke="${theme.accent}" stroke-width="1"/>`;
      output += text(width - margin, centerY + clamp(rowHeight * .26, 5, 8), '—', {
        class: 'mono', fill: theme.muted, 'font-size': clamp(rowHeight * .52, 10, 15), 'text-anchor': 'end',
      });
      return;
    }
    const barWidth = (Math.abs(value) / span) * (plotRight - plotLeft);
    const x = value < 0 ? zeroX - barWidth : zeroX;
    output += `<rect x="${x}" y="${y}" width="${Math.max(barWidth, value === 0 ? 1.5 : 0)}" height="${barHeight}" fill="${theme.accent}"/>`;
    output += text(width - margin, centerY + clamp(rowHeight * .26, 5, 8), formatValue(value, unit), {
      class: 'mono', fill: theme.ink, 'font-size': clamp(rowHeight * .52, 10, 15), 'text-anchor': 'end',
    });
  });
  return output;
}

function renderDots({ rows, categoryKey, valueKey, unit, theme, width, chartTop, chartBottom, margin }) {
  const values = rows.map((row) => number(row?.[valueKey]));
  const valid = values.filter((value) => value !== null);
  if (!valid.length) return renderMessage({ theme, width, chartTop, chartBottom, title: 'нет числовых значений', detail: 'выберите числовую колонку или добавьте значения.' });
  const min = Math.min(...valid, 0);
  const max = Math.max(...valid, 0);
  const span = Math.max(max - min, 1);
  const labelWidth = width < 1100 ? 230 : 215;
  const valueWidth = width < 1100 ? 130 : 118;
  const plotLeft = margin + labelWidth;
  const plotRight = width - margin - valueWidth;
  const top = chartTop + 38;
  const bottom = Math.max(top + 20, chartBottom - 10);
  const rowHeight = (bottom - top) / Math.max(rows.length, 1);
  const radius = clamp(rowHeight * .17, 4, width < 1100 ? 9 : 7);
  let output = renderAxis({ min, max, x1: plotLeft, x2: plotRight, y: chartTop + 20, theme, fontSize: width < 1100 ? 11 : 10 });
  rows.forEach((row, index) => {
    const value = values[index];
    const centerY = top + index * rowHeight + rowHeight / 2;
    const category = shorten(row?.[categoryKey] ?? row?.date ?? `строка ${index + 1}`, width < 1100 ? 30 : 26);
    output += `<line x1="${plotLeft}" y1="${centerY}" x2="${plotRight}" y2="${centerY}" stroke="${theme.line}" stroke-width="1" stroke-dasharray="1 8"/>`;
    output += text(margin, centerY + clamp(rowHeight * .22, 5, 8), category, {
      class: 'golos', fill: theme.ink, 'font-size': clamp(rowHeight * .52, 10, 15),
    });
    if (value === null) {
      output += `<line x1="${plotLeft - 5}" y1="${centerY - radius}" x2="${plotLeft + 5}" y2="${centerY + radius}" stroke="${theme.accent}" stroke-width="2"/><line x1="${plotLeft + 5}" y1="${centerY - radius}" x2="${plotLeft - 5}" y2="${centerY + radius}" stroke="${theme.accent}" stroke-width="2"/>`;
      output += text(width - margin, centerY + clamp(rowHeight * .22, 5, 8), '—', { class: 'mono', fill: theme.muted, 'font-size': clamp(rowHeight * .52, 10, 15), 'text-anchor': 'end' });
      return;
    }
    const x = plotLeft + ((value - min) / span) * (plotRight - plotLeft);
    output += `<circle cx="${x}" cy="${centerY}" r="${radius}" fill="${theme.accent}" stroke="${theme.paper}" stroke-width="2"/>`;
    output += text(width - margin, centerY + clamp(rowHeight * .22, 5, 8), formatValue(value, unit), { class: 'mono', fill: theme.ink, 'font-size': clamp(rowHeight * .52, 10, 15), 'text-anchor': 'end' });
  });
  return output;
}

function calendarEntries(rows, dateKey, valueKey) {
  const groups = new Map();
  const undated = [];
  rows.forEach((row, index) => {
    const date = asDate(row?.[dateKey]);
    if (!date) { undated.push({ row, index }); return; }
    const iso = isoDate(date);
    const month = iso.slice(0, 7);
    if (!groups.has(month)) groups.set(month, { date: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)), cells: new Map() });
    if (!groups.get(month).cells.has(iso)) groups.get(month).cells.set(iso, []);
    groups.get(month).cells.get(iso).push({ row, index, value: number(row?.[valueKey]), raw: row?.[valueKey] });
  });
  return { groups: [...groups.values()].sort((a, b) => a.date - b.date), undated };
}

function renderCalendar({ rows, dateKey, valueKey, unit, theme, width, chartTop, chartBottom, margin, categoryKey }) {
  if (!safeText(dateKey)) return renderMessage({ theme, width, chartTop, chartBottom, title: 'нужна колонка с датой', detail: 'выберите колонку с датой для календарной сетки.' });
  const { groups, undated } = calendarEntries(rows, dateKey, valueKey);
  if (!groups.length) return renderMessage({ theme, width, chartTop, chartBottom, title: 'нет корректных дат', detail: 'проверьте формат дат в выбранной колонке.' });
  const stories = width < 1100;
  const cols = Math.min(stories ? 3 : 5, groups.length);
  const gap = stories ? 18 : 12;
  const totalWidth = width - margin * 2;
  const blockWidth = (totalWidth - gap * (cols - 1)) / cols;
  const rowsOfBlocks = Math.ceil(groups.length / cols);
  const maxWeeks = Math.max(...groups.map((group) => {
    const first = group.date;
    const offset = (first.getUTCDay() + 6) % 7;
    return Math.ceil((offset + new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()) / 7);
  }));
  const availableHeight = Math.max(110, chartBottom - chartTop - rowsOfBlocks * 35 - (rowsOfBlocks - 1) * gap);
  const cellHeight = clamp(availableHeight / (rowsOfBlocks * maxWeeks), stories ? 18 : 14, stories ? 48 : 30);
  const cellWidth = (blockWidth - 8) / 7;
  const blockHeight = 33 + maxWeeks * cellHeight;
  const weekdays = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
  const maxCalendarValue = Math.max(...rows.map((row) => Math.abs(number(row?.[valueKey]) ?? 0)), 1);
  let output = '';
  groups.forEach((group, groupIndex) => {
    const col = groupIndex % cols;
    const rowIndex = Math.floor(groupIndex / cols);
    const x0 = margin + col * (blockWidth + gap);
    const y0 = chartTop + rowIndex * (blockHeight + gap);
    const first = group.date;
    const offset = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    output += text(x0, y0 + 15, monthLabel(first), { class: 'literata', fill: theme.ink, 'font-size': stories ? 18 : 15, 'font-weight': 600 });
    weekdays.forEach((weekday, weekdayIndex) => {
      output += text(x0 + weekdayIndex * cellWidth + 2, y0 + 29, weekday, { class: 'mono', fill: theme.accent, 'font-size': stories ? 9 : 8 });
    });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayIndex = offset + day - 1;
      const cellX = x0 + (dayIndex % 7) * cellWidth;
      const cellY = y0 + 35 + Math.floor(dayIndex / 7) * cellHeight;
      const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day));
      const iso = isoDate(date);
      const entries = group.cells.get(iso) || [];
      const numericEntries = entries.filter((entry) => entry.value !== null);
      const hasMissing = entries.some((entry) => entry.value === null);
      output += `<rect x="${cellX}" y="${cellY}" width="${Math.max(2, cellWidth - 3)}" height="${Math.max(2, cellHeight - 3)}" fill="${theme.paper}" stroke="${theme.line}" stroke-width=".8"/>`;
      output += text(cellX + 3, cellY + clamp(cellHeight * .34, 8, 13), day, { class: 'mono', fill: theme.muted, 'font-size': stories ? 10 : 9 });
      if (!entries.length) continue;
      const titleValues = entries.map((entry) => entry.value === null ? '—' : formatValue(entry.value, unit)).join(', ');
      const aggregate = numericEntries.reduce((sum, entry) => sum + entry.value, 0);
      const ratio = Math.min(1, Math.abs(aggregate) / maxCalendarValue);
      const innerWidth = Math.max(1, (cellWidth - 8) * (numericEntries.length ? Math.max(.08, ratio) : .08));
      output += `<title>${esc(`${iso}: ${titleValues}`)}</title>`;
      if (numericEntries.length) {
        output += `<rect x="${cellX + 3}" y="${cellY + cellHeight - 8}" width="${innerWidth}" height="3" fill="${theme.accent}"/>`;
        const valueLabel = entries.length > 1
          ? `${entries.length}× · ${formatNumber(aggregate)}${numericEntries.length < entries.length ? ' · —' : ''}`
          : formatNumber(numericEntries[0].value);
        output += text(cellX + 3, cellY + cellHeight - 12, shorten(valueLabel, stories ? 12 : 10), { class: 'mono', fill: theme.ink, 'font-size': stories ? 9 : 8 });
      } else {
        output += `<rect x="${cellX + 2}" y="${cellY + cellHeight - 7}" width="${Math.max(1, cellWidth - 7)}" height="3" fill="url(#missing-hatch)"/>`;
        const textValues = entries.map((entry) => entry.raw === null || entry.raw === undefined || String(entry.raw).trim() === '' ? '—' : String(entry.raw).trim()).join(' / ');
        const textLabel = hasMissing && !textValues.replace(/([ —/])/g, '') ? '—' : (entries.length > 1 ? `${entries.length}× · ${textValues}` : textValues);
        output += text(cellX + 3, cellY + cellHeight - 12, shorten(textLabel, stories ? 12 : 10), { class: 'mono', fill: theme.muted, 'font-size': stories ? 9 : 8 });
      }
      if (entries.length > 1 && numericEntries.length) output += text(cellX + cellWidth - 5, cellY + clamp(cellHeight * .34, 8, 13), `${entries.length}×`, { class: 'mono', fill: theme.accentAlt || theme.accent, 'font-size': stories ? 8 : 7, 'text-anchor': 'end' });
    }
  });
  const lastRowY = chartTop + rowsOfBlocks * (blockHeight + gap) - gap;
  if (undated.length) {
    const undatedText = undated.slice(0, 3).map(({ row, index }) => `${shorten(row?.[categoryKey] ?? `строка ${index + 1}`, stories ? 15 : 18)} · ${formatValue(number(row?.[valueKey]), unit)}`).join('  |  ');
    output += text(margin, Math.min(chartBottom - 12, lastRowY + 26), `без корректной даты · ${undated.length} ${russianPlural(undated.length, 'строка', 'строки', 'строк')}`, { class: 'golos', fill: theme.accentAlt || theme.accent, 'font-size': 12 });
    output += text(margin, Math.min(chartBottom + 4, lastRowY + 46), undatedText, { class: 'mono', fill: theme.muted, 'font-size': 10 });
  }
  return output;
}

function timelineData(rows, dateKey, valueKey) {
  const points = [];
  const undated = [];
  rows.forEach((row, index) => {
    const date = asDate(row?.[dateKey]);
    if (date) points.push({ date, iso: isoDate(date), value: number(row?.[valueKey]), row, index });
    else undated.push({ row, index });
  });
  points.sort((a, b) => a.date - b.date || a.index - b.index);
  const counts = new Map();
  points.forEach((point) => counts.set(point.iso, (counts.get(point.iso) || 0) + 1));
  const seen = new Map();
  points.forEach((point) => { const n = counts.get(point.iso); point.duplicate = n > 1; point.ordinal = seen.get(point.iso) || 0; seen.set(point.iso, point.ordinal + 1); });
  return { points, undated };
}

function renderTimeline({ rows, dateKey, valueKey, unit, theme, width, chartTop, chartBottom, margin }) {
  if (!safeText(dateKey)) return renderMessage({ theme, width, chartTop, chartBottom, title: 'нужна колонка с датой', detail: 'выберите колонку с датой для временного маршрута.' });
  const { points, undated } = timelineData(rows, dateKey, valueKey);
  if (!points.length) return renderMessage({ theme, width, chartTop, chartBottom, title: 'нет корректных дат', detail: 'проверьте формат дат в выбранной колонке.' });
  const valid = points.map((point) => point.value).filter((value) => value !== null);
  if (!valid.length) return renderMessage({ theme, width, chartTop, chartBottom, title: 'нет числовых значений', detail: 'добавьте значения для выбранной колонки.' });
  const min = Math.min(...valid, 0);
  const max = Math.max(...valid, 0);
  const span = Math.max(max - min, 1);
  const left = margin + 14;
  const right = width - margin - 14;
  const top = chartTop + 32;
  const bottom = Math.max(top + 50, chartBottom - 46);
  const dateMin = points[0].date.valueOf();
  const dateMax = points[points.length - 1].date.valueOf();
  const dateSpan = Math.max(dateMax - dateMin, 1);
  const yFor = (value) => bottom - ((value - min) / span) * (bottom - top);
  const xFor = (point) => {
    const base = dateMax === dateMin ? (left + right) / 2 : left + ((point.date.valueOf() - dateMin) / dateSpan) * (right - left);
    if (!point.duplicate) return base;
    const total = points.filter((candidate) => candidate.iso === point.iso).length;
    return base + (point.ordinal - (total - 1) / 2) * clamp((right - left) / Math.max(points.length, 10) * .32, 5, 13);
  };
  let output = '';
  axisTicks(min, max, 4).forEach((tick) => {
    const y = yFor(tick);
    output += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="${theme.line}" stroke-width="1" stroke-dasharray="2 8"/>`;
    output += text(margin, y + 4, formatNumber(tick), { class: 'mono', fill: theme.muted, 'font-size': width < 1100 ? 11 : 10 });
  });
  output += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${theme.ink}" stroke-width="1.2"/>`;
  let segment = [];
  const segments = [];
  points.forEach((point) => {
    if (point.value === null) { if (segment.length) segments.push(segment); segment = []; return; }
    segment.push(point);
  });
  if (segment.length) segments.push(segment);
  segments.forEach((items) => {
    const d = items.map((point, index) => `${index ? 'L' : 'M'} ${xFor(point)} ${yFor(point.value)}`).join(' ');
    output += `<path d="${d}" fill="none" stroke="${theme.accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  const labelStep = points.length > 12 ? 2 : 1;
  points.forEach((point, index) => {
    const x = xFor(point);
    const y = point.value === null ? bottom : yFor(point.value);
    if (point.value === null) {
      output += `<line x1="${x - 5}" y1="${bottom - 7}" x2="${x + 5}" y2="${bottom + 3}" stroke="${theme.accentAlt || theme.accent}" stroke-width="2"/>`;
    } else {
      output += `<circle cx="${x}" cy="${y}" r="${width < 1100 ? 6 : 5}" fill="${theme.paper}" stroke="${theme.accent}" stroke-width="2.5"/>`;
      const labelY = y < top + 30 ? y + 22 : y - 14;
      output += text(x, labelY, formatValue(point.value, unit), { class: 'mono', fill: theme.ink, 'font-size': width < 1100 ? 11 : 10, 'text-anchor': 'middle' });
    }
    if (index % labelStep === 0 || index === points.length - 1) {
      output += `<line x1="${x}" y1="${bottom + 4}" x2="${x}" y2="${bottom + 12}" stroke="${theme.line}" stroke-width="1"/>`;
      output += text(x, bottom + 31, dateLabel(point.date), { class: 'mono', fill: theme.muted, 'font-size': width < 1100 ? 10 : 9, 'text-anchor': 'middle' });
    }
  });
  if (undated.length) {
    const noteY = Math.min(chartBottom - 4, bottom + 42);
    const sample = undated.slice(0, 3).map(({ row, index }) => shorten(row?.[valueKey] ?? `строка ${index + 1}`, width < 1100 ? 16 : 20)).join('  ·  ');
    output += text(margin, noteY, `без корректной даты · ${undated.length} ${russianPlural(undated.length, 'строка', 'строки', 'строк')}`, { class: 'golos', fill: theme.accentAlt || theme.accent, 'font-size': 12 });
    output += text(margin, Math.min(chartBottom + 16, noteY + 20), sample, { class: 'mono', fill: theme.muted, 'font-size': 10 });
  }
  return output;
}

function renderMessage({ theme, width, chartTop, chartBottom, title, detail }) {
  const centerX = width / 2;
  const centerY = chartTop + Math.max(80, (chartBottom - chartTop) * .45);
  return `<g>
    <line x1="${width / 2 - 110}" y1="${centerY - 40}" x2="${width / 2 + 110}" y2="${centerY - 40}" stroke="${theme.line}"/>
    ${text(centerX, centerY + 4, title, { class: 'literata', fill: theme.ink, 'font-size': width < 1100 ? 28 : 27, 'text-anchor': 'middle' })}
    ${text(centerX, centerY + 34, detail, { class: 'golos', fill: theme.muted, 'font-size': width < 1100 ? 15 : 14, 'text-anchor': 'middle' })}
  </g>`;
}

function renderFooter({ width, height, margin, theme, rows, valueKey, unit, mode }) {
  const y = height - (width < 1100 ? 92 : 58);
  const missing = rows.some((row) => {
    const raw = row?.[valueKey];
    if (raw === null || raw === undefined || String(raw).trim() === '') return true;
    return mode !== 'calendar' && number(raw) === null;
  });
  let output = `<line x1="${margin}" y1="${y - 20}" x2="${width - margin}" y2="${y - 20}" stroke="${theme.line}" stroke-width="1"/>`;
  if (missing) {
    output += `<rect x="${margin}" y="${y - 8}" width="18" height="10" fill="url(#missing-hatch)" stroke="${theme.accent}" stroke-width=".8"/>`;
    output += text(margin + 28, y + 1, 'нет значения', { class: 'golos', fill: theme.muted, 'font-size': 12 });
  }
  if (safeText(unit)) output += text(width - margin, y + 1, safeText(unit), { class: 'mono', fill: theme.muted, 'font-size': 12, 'text-anchor': 'end' });
  return output;
}

export function buildScene({ rows = [], state = {}, dataset = {}, themeName = 'paper' } = {}) {
  state = state || {};
  const theme = THEMES[themeName] || THEMES.paper;
  const stories = state.size === 'stories';
  const width = stories ? 1080 : 1200;
  const height = stories ? 1920 : 900;
  const margin = stories ? 88 : 90;
  const mode = state.mode || 'bars';
  const columns = Array.isArray(dataset?.columns) ? dataset.columns : [];
  const headers = Array.isArray(dataset?.headers) ? dataset.headers : [];
  const categoryKey = state.categoryKey || columns.find((column) => column.type === 'category')?.key || headers[0] || '';
  const valueKey = state.valueKey || columns.find((column) => column.type === 'number')?.key || headers[1] || '';
  const dateKey = state.dateKey || columns.find((column) => column.type === 'date')?.key || '';
  const unit = safeText(state.unit);
  const safeRows = Array.isArray(rows) ? rows.slice(0, 20) : [];
  const header = renderHeader({ state, theme, width, margin, rows: safeRows, valueKey, unit });
  const chartBottom = height - (stories ? 138 : 104);
  const payload = { rows: safeRows, categoryKey, valueKey, dateKey, unit, theme, width, chartTop: header.chartTop, chartBottom, margin, state };
  let chart;
  if (!safeRows.length) chart = renderMessage({ theme, width, chartTop: header.chartTop, chartBottom, title: 'нет строк для отображения', detail: 'добавьте строки данных, чтобы собрать открытку.' });
  else if (mode === 'calendar') chart = renderCalendar(payload);
  else if (mode === 'timeline') chart = renderTimeline(payload);
  else if (mode === 'dots') chart = renderDots(payload);
  else chart = renderBars(payload);
  const body = `${baseDefs(theme)}<style>${FONT_CSS}</style><rect width="${width}" height="${height}" fill="${theme.paper}"/><rect width="${width}" height="${height}" fill="url(#paper-lines)"/>${header.markup}<g aria-label="${esc(mode)}">${chart}</g>${renderFooter({ width, height, margin, theme, rows: safeRows, valueKey, unit, mode })}`;
  const title = safeText(state.title, 'новая заметка');
  const caption = safeText(state.caption, 'маленькая история из ваших строк.');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="scene-title scene-desc"><title id="scene-title">${esc(title)}</title><desc id="scene-desc">${esc(caption)}</desc>${body}</svg>`;
}
