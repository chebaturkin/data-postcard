import { parseDate, parseNumber } from './data.js';
import { THEMES } from './themes.js';

const esc = (value) => String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
const short = (value, limit = 18) => { const text = String(value ?? ''); return text.length > limit ? `${text.slice(0, limit - 1)}…` : text; };
const number = (value) => parseNumber(value);
const formatValue = (value, unit = '') => value === null || value === undefined || Number.isNaN(value) ? '—' : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ''}`;
const dateLabel = (value) => { const date = parseDate(value); return date ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(date).replace('.', '') : String(value ?? ''); };

function text(x, y, content, style = {}) {
  const attrs = Object.entries(style).map(([key, value]) => `${key}="${esc(value)}"`).join(' ');
  return `<text x="${x}" y="${y}" ${attrs}>${esc(content)}</text>`;
}

function baseDefs(theme) {
  return `<defs>
    <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="${theme.accent}" opacity=".28"/></pattern>
    <pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M-3 3L3 -3M0 14L14 0M11 17L17 11" stroke="${theme.accent}" stroke-width="1" opacity=".35"/></pattern>
    <pattern id="paper-grain" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M0 13H72M0 58H72" stroke="${theme.ink}" stroke-opacity=".045"/><circle cx="18" cy="34" r=".9" fill="${theme.ink}" fill-opacity=".05"/><circle cx="53" cy="4" r=".8" fill="${theme.ink}" fill-opacity=".04"/></pattern>
  </defs>`;
}

function commonHeader(state, theme, width) {
  const pad = width === 1080 ? 92 : 90;
  return `${text(pad, 92, state.title, { fill: theme.ink, 'font-size': width === 1080 ? 62 : 66, 'font-family': 'Georgia, serif', 'font-weight': 600, 'letter-spacing': '-1.4' })}
  ${text(pad + 3, 140, state.caption, { fill: theme.muted, 'font-size': 19, 'font-family': 'Trebuchet MS, sans-serif' })}
  <line x1="${pad}" y1="174" x2="${width - pad}" y2="174" stroke="${theme.line}" stroke-width="1"/>
  ${text(pad, 215, String(state.unit || 'наблюдения').toUpperCase(), { fill: theme.accent, 'font-size': 12, 'font-family': 'Menlo, monospace', 'letter-spacing': 2 })}`;
}

function renderBars({ rows, categoryKey, valueKey, unit, state, theme, width, height }) {
  const pad = width === 1080 ? 92 : 90; const top = 260; const bottom = height - (width === 1080 ? 250 : 195);
  const values = rows.map((row) => number(row[valueKey])); const valid = values.filter((v) => v !== null); const max = Math.max(...valid, 1); const min = Math.min(...valid, 0); const range = Math.max(max - min, 1); const gap = width === 1080 ? 22 : 18; const barWidth = Math.max(30, (width - pad * 2 - gap * (rows.length - 1)) / rows.length); const chartHeight = bottom - top;
  const marks = rows.map((row, index) => { const value = number(row[valueKey]); const x = pad + index * (barWidth + gap); const h = value === null ? 18 : 32 + ((value - min) / range) * (chartHeight - 76); const y = bottom - h; const label = short(row[categoryKey] ?? row.date ?? `0${index + 1}`, width === 1080 ? 12 : 14); const fill = value === null ? 'url(#hatch)' : theme.accent; return `<g opacity="${value === null ? '.5' : '1'}"><line x1="${x + barWidth / 2}" y1="${top - 18}" x2="${x + barWidth / 2}" y2="${bottom + 8}" stroke="${theme.line}" stroke-dasharray="2 11"/><rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${fill}"/><circle cx="${x + barWidth / 2}" cy="${y}" r="4" fill="${theme.paper}" stroke="${theme.accent}" stroke-width="2"/>${text(x + barWidth / 2, y - 18, formatValue(value, unit), { fill: theme.ink, 'text-anchor': 'middle', 'font-size': 17, 'font-family': 'Menlo, monospace' })}${text(x + barWidth / 2, bottom + 34, label, { fill: theme.muted, 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'Menlo, monospace', transform: `rotate(-26 ${x + barWidth / 2} ${bottom + 34})` })}</g>`; }).join('');
  return `${marks}<line x1="${pad}" y1="${bottom + 72}" x2="${width - pad}" y2="${bottom + 72}" stroke="${theme.line}"/>${text(pad, bottom + 105, 'ПОЛОСЫ / ОТНОСИТЕЛЬНАЯ ВЕЛИЧИНА', { fill: theme.muted, 'font-size': 12, 'font-family': 'Menlo, monospace', 'letter-spacing': 1.5 })}`;
}

function renderDots({ rows, categoryKey, valueKey, unit, theme, width, height }) {
  const pad = width === 1080 ? 92 : 90; const top = 270; const bottom = height - (width === 1080 ? 245 : 190); const max = Math.max(...rows.map((row) => number(row[valueKey]) ?? 0), 1); const rowHeight = (bottom - top) / rows.length; const dots = rows.map((row, index) => { const value = number(row[valueKey]); const count = value === null ? 0 : Math.round((value / max) * 24); const y = top + rowHeight * index + rowHeight / 2; const label = short(row[categoryKey] ?? row.date ?? `0${index + 1}`, 17); const points = Array.from({ length: Math.max(count, value === null ? 0 : 1) }, (_, dotIndex) => { const x = pad + 170 + dotIndex * 25; return `<circle cx="${x}" cy="${y}" r="5" fill="${value === null ? 'url(#hatch)' : theme.accent}"/>`; }).join(''); return `${text(pad, y + 5, label, { fill: theme.muted, 'font-size': 13, 'font-family': 'Menlo, monospace' })}${points}${text(width - pad, y + 5, formatValue(value, unit), { fill: theme.ink, 'text-anchor': 'end', 'font-size': 16, 'font-family': 'Menlo, monospace' })}<line x1="${pad + 170}" y1="${y + 18}" x2="${width - pad}" y2="${y + 18}" stroke="${theme.line}" stroke-dasharray="1 8"/>`; }).join('');
  return `${dots}${text(pad, top - 32, 'ТОЧКИ / КАЖДАЯ ТОЧКА — ЧАСТЬ ЦЕЛОГО', { fill: theme.muted, 'font-size': 12, 'font-family': 'Menlo, monospace', 'letter-spacing': 1.2 })}`;
}

function renderCalendar({ rows, dateKey, valueKey, unit, theme, width, height }) {
  const pad = width === 1080 ? 92 : 90; const gridTop = 285; const cols = 7; const cell = Math.min(100, (width - pad * 2) / cols); const gridWidth = cell * cols; const cellHeight = width === 1080 ? 112 : 72; const max = Math.max(...rows.map((row) => number(row[valueKey]) ?? 0), 1); const start = rows.map((row) => parseDate(row[dateKey])).filter(Boolean).sort((a, b) => a - b)[0] || new Date(); const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); const offset = (first.getUTCDay() + 6) % 7; const cells = Array.from({ length: 35 }, (_, index) => { const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1 + index - offset)); const match = rows.find((row) => { const d = parseDate(row[dateKey]); return d && d.toISOString().slice(0, 10) === date.toISOString().slice(0, 10); }); const value = match ? number(match[valueKey]) : null; const x = pad + (index % cols) * cell; const y = gridTop + Math.floor(index / cols) * cellHeight; const ratio = value === null ? 0 : Math.max(.08, value / max); return `<rect x="${x}" y="${y}" width="${cell - 5}" height="${cellHeight - 5}" fill="${value === null ? 'url(#hatch)' : theme.accent}" opacity="${value === null ? '.16' : .2 + ratio * .8}"/>${text(x + 8, y + 22, date.getUTCDate(), { fill: theme.muted, 'font-size': 12, 'font-family': 'Menlo, monospace' })}${match ? text(x + 8, y + cellHeight - 18, formatValue(value, unit), { fill: theme.ink, 'font-size': 14, 'font-family': 'Menlo, monospace' }) : ''}`; }).join('');
  const weekdays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((day, index) => text(pad + index * cell + 8, gridTop - 18, day, { fill: theme.accent, 'font-size': 11, 'font-family': 'Menlo, monospace', 'letter-spacing': 1 } )).join('');
  return `${weekdays}${cells}${text(pad, gridTop + cellHeight * 5 + 32, 'КАЛЕНДАРНАЯ СЕТКА / ДЕНЬ ЗА ДНЁМ', { fill: theme.muted, 'font-size': 12, 'font-family': 'Menlo, monospace', 'letter-spacing': 1.2 })}`;
}

function renderTimeline({ rows, dateKey, valueKey, unit, theme, width, height }) {
  const pad = width === 1080 ? 92 : 90; const left = pad + 30; const right = width - pad - 30; const top = 300; const bottom = height - (width === 1080 ? 270 : 220); const points = rows.map((row) => ({ date: parseDate(row[dateKey]), value: number(row[valueKey]), row })).filter((item) => item.date); points.sort((a, b) => a.date - b.date); const values = points.map((point) => point.value).filter((value) => value !== null); const min = Math.min(...values, 0); const max = Math.max(...values, 1); const range = Math.max(max - min, 1); const path = points.map((point, index) => { const x = left + (points.length === 1 ? 0 : index / (points.length - 1)) * (right - left); const y = bottom - ((point.value ?? min) - min) / range * (bottom - top); return `${index ? 'L' : 'M'} ${x} ${y}`; }).join(' '); const marks = points.map((point, index) => { const x = left + (points.length === 1 ? 0 : index / (points.length - 1)) * (right - left); const y = bottom - ((point.value ?? min) - min) / range * (bottom - top); return `<line x1="${x}" y1="${bottom + 12}" x2="${x}" y2="${bottom + 20}" stroke="${theme.line}"/>${text(x, bottom + 42, dateLabel(point.date), { fill: theme.muted, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'Menlo, monospace' })}<circle cx="${x}" cy="${y}" r="7" fill="${theme.paper}" stroke="${theme.accent}" stroke-width="3"/>${text(x, y - 18, formatValue(point.value, unit), { fill: theme.ink, 'text-anchor': 'middle', 'font-size': 15, 'font-family': 'Menlo, monospace' })}`; }).join(''); return `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${theme.line}"/>${path ? `<path d="${path}" fill="none" stroke="${theme.accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : ''}${marks}${text(pad, top - 32, 'ВРЕМЕННОЙ МАРШРУТ / ДВИЖЕНИЕ ВО ВРЕМЕНИ', { fill: theme.muted, 'font-size': 12, 'font-family': 'Menlo, monospace', 'letter-spacing': 1.2 })}`;
}

export function buildScene({ rows = [], state, dataset, themeName = 'night' }) {
  const theme = THEMES[themeName] || THEMES.night; const stories = state.size === 'stories'; const width = stories ? 1080 : 1200; const height = stories ? 1920 : 900; const mode = state.mode || 'bars'; const categoryKey = state.categoryKey || dataset?.columns?.find((column) => column.type === 'category')?.key || dataset?.headers?.[0]; const valueKey = state.valueKey || dataset?.columns?.find((column) => column.type === 'number')?.key || dataset?.headers?.[1]; const dateKey = state.dateKey || dataset?.columns?.find((column) => column.type === 'date')?.key || '';
  const payload = { rows, categoryKey, valueKey, dateKey, unit: state.unit, state, theme, width, height };
  let chart = mode === 'dots' ? renderDots(payload) : mode === 'calendar' && dateKey ? renderCalendar(payload) : mode === 'timeline' && dateKey ? renderTimeline(payload) : renderBars(payload);
  if (stories) chart = `<g transform="translate(0, 210)">${chart}</g>`;
  const footerY = height - 70;
  const body = `${baseDefs(theme)}<rect width="${width}" height="${height}" fill="${theme.paper}"/><rect width="${width}" height="${height}" fill="url(#paper-grain)"/>${commonHeader(state, theme, width)}${chart}<line x1="${width === 1080 ? 92 : 90}" y1="${footerY - 20}" x2="${width - (width === 1080 ? 92 : 90)}" y2="${footerY - 20}" stroke="${theme.line}"/>${text(width === 1080 ? 92 : 90, footerY + 10, `LOCAL NOTE · ${state.sourceLabel || 'DATA POSTCARD'}`, { fill: theme.muted, 'font-size': 12, 'font-family': 'Menlo, monospace', 'letter-spacing': 1.2 })}${text(width - (width === 1080 ? 92 : 90), footerY + 10, `DATA POSTCARD / ${String(rows.length).padStart(2, '0')}`, { fill: theme.accent, 'text-anchor': 'end', 'font-size': 12, 'font-family': 'Menlo, monospace', 'letter-spacing': 1.2 })}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="scene-title scene-desc"><title id="scene-title">${esc(state.title)}</title><desc id="scene-desc">${esc(state.caption)}</desc>${body}</svg>`;
}
