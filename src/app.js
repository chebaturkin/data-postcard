/* Data Postcard shell. Parsing and export modules attach to this state in later steps. */
const SAMPLES = {
  reading: {
    label: 'sample reading',
    title: 'Тихие страницы',
    caption: 'Сколько минут осталось между делами этой недели.',
    unit: 'минуты',
    headers: ['день', 'минуты'],
    rows: [
      { day: 'понедельник', minutes: 32 },
      { day: 'вторник', minutes: 48 },
      { day: 'среда', minutes: 26 },
      { day: 'четверг', minutes: 61 },
      { day: 'пятница', minutes: 42 },
      { day: 'суббота', minutes: 76 },
      { day: 'воскресенье', minutes: 53 }
    ]
  },
  weather: {
    label: 'sample weather',
    title: 'Окно на север',
    caption: 'Температура и свет в конце длинной недели.',
    unit: '°C',
    headers: ['дата', 'температура'],
    rows: [
      { date: '2026-10-02', temperature: 11 },
      { date: '2026-10-03', temperature: 13 },
      { date: '2026-10-04', temperature: 8 },
      { date: '2026-10-05', temperature: 7 },
      { date: '2026-10-06', temperature: 10 },
      { date: '2026-10-07', temperature: 12 },
      { date: '2026-10-08', temperature: 9 }
    ]
  },
  sport: {
    label: 'sample sport',
    title: 'Дворовая дистанция',
    caption: 'Круги после работы, пока площадка не опустела.',
    unit: 'круги',
    headers: ['дата', 'круги'],
    rows: [
      { date: '2026-09-28', circles: 4 },
      { date: '2026-09-29', circles: 6 },
      { date: '2026-09-30', circles: 5 },
      { date: '2026-10-01', circles: 8 },
      { date: '2026-10-02', circles: 7 },
      { date: '2026-10-03', circles: 10 },
      { date: '2026-10-04', circles: 9 }
    ]
  }
};

const state = {
  sample: 'reading',
  ...SAMPLES.reading,
  mode: 'bars',
  order: 'input',
  theme: 'night',
  size: 'landscape',
  showMissing: true,
  categoryKey: 'day',
  valueKey: 'minutes',
  dateKey: ''
};

const $ = (id) => document.getElementById(id);
const escapeXml = (value) => String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
const shortLabel = (value, length = 16) => String(value ?? '').length > length ? `${String(value).slice(0, length - 1)}…` : String(value ?? '');
const numberValue = (row) => {
  const value = Number(row[state.valueKey]);
  return Number.isFinite(value) ? value : null;
};

function setSelectOptions(select, options, selected = '') {
  if (!select) return;
  select.innerHTML = options.map((option) => `<option value="${escapeXml(option.value)}">${escapeXml(option.label)}</option>`).join('');
  if (options.some((option) => option.value === selected)) select.value = selected;
}

function syncColumns() {
  const headers = state.headers || [];
  const values = headers.map((header) => ({ value: header, label: header }));
  setSelectOptions($('category-select'), values, state.categoryKey || headers[0]);
  setSelectOptions($('value-select'), values, state.valueKey || headers[1] || headers[0]);
  setSelectOptions($('date-select'), [{ value: '', label: 'не используется' }, ...values], state.dateKey || '');
}

function updateText() {
  $('title-input').value = state.title;
  $('caption-input').value = state.caption;
  $('unit-input').value = state.unit;
  $('mode-select').value = state.mode;
  $('order-select').value = state.order;
  $('theme-select').value = state.theme;
  $('size-select').value = state.size;
  $('missing-toggle').checked = state.showMissing;
  $('data-summary').textContent = `Пример: ${state.rows.length} строк · ${state.headers.length} колонки`;
  $('postcard-kicker').textContent = `${state.title} · ${String(state.rows.length).padStart(2, '0')} наблюдений`;
  $('postcard-source').textContent = `локальная заметка · ${state.label}`;
  $('postcard-stage').setAttribute('aria-label', state.size === 'stories' ? 'Открытка 1080 на 1920' : 'Открытка 1200 на 900');
  $('postcard-paper').dataset.theme = state.theme;
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.size = state.size;
  $('render-status').textContent = `${state.rows.length} строк · ${state.mode}`;
}

function renderPlaceholder() {
  const svg = $('postcard-preview');
  const rows = state.rows.slice();
  const values = rows.map(numberValue).filter((value) => value !== null);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const width = 1200;
  const height = 900;
  const chartLeft = 90;
  const chartRight = 1110;
  const chartTop = 250;
  const chartBottom = 690;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;
  const barGap = 18;
  const barWidth = Math.max(36, (chartWidth - barGap * (rows.length - 1)) / rows.length);
  const bars = rows.map((row, index) => {
    const value = numberValue(row);
    const heightValue = value === null ? 12 : 36 + ((value - min) / range) * (chartHeight - 85);
    const x = chartLeft + index * (barWidth + barGap);
    const y = chartBottom - heightValue;
    const label = shortLabel(row[state.categoryKey] || row[state.dateKey] || `0${index + 1}`, 13);
    const textValue = value === null ? '—' : `${value}${state.unit ? ` ${state.unit}` : ''}`;
    return `<g class="placeholder-bar" opacity="${value === null ? '.42' : '1'}">
      <line x1="${x + barWidth / 2}" y1="${chartTop - 18}" x2="${x + barWidth / 2}" y2="${chartBottom + 12}" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 10"/>
      <rect x="${x}" y="${y}" width="${barWidth}" height="${heightValue}" fill="var(--accent)"/>
      <circle cx="${x + barWidth / 2}" cy="${y}" r="4" fill="var(--paper)" stroke="var(--accent)" stroke-width="2"/>
      <text x="${x + barWidth / 2}" y="${y - 17}" fill="var(--ink)" text-anchor="middle" font-size="18" font-family="var(--font-mono)">${escapeXml(textValue)}</text>
      <text x="${x + barWidth / 2}" y="${chartBottom + 34}" fill="var(--muted)" text-anchor="middle" font-size="13" font-family="var(--font-mono)" transform="rotate(-28 ${x + barWidth / 2} ${chartBottom + 34})">${escapeXml(label)}</text>
    </g>`;
  }).join('');

  svg.innerHTML = `<defs>
    <pattern id="postcard-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="var(--accent)" opacity=".28"/></pattern>
    <pattern id="postcard-lines" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 28L28 0" stroke="var(--accent)" stroke-width="1" opacity=".14"/></pattern>
  </defs>
  <g aria-hidden="true">
    <text id="postcard-title" x="90" y="112" fill="var(--ink)" font-size="66" font-family="var(--font-display)" font-weight="600" letter-spacing="-1.5">${escapeXml(state.title)}</text>
    <text id="postcard-caption" x="94" y="160" fill="var(--muted)" font-size="20" font-family="var(--font-sans)">${escapeXml(state.caption)}</text>
    <line x1="90" y1="198" x2="1110" y2="198" stroke="var(--line)" stroke-width="1"/>
    <rect x="90" y="${chartTop - 32}" width="1020" height="${chartHeight + 80}" fill="url(#postcard-dots)" opacity=".34"/>
    <text x="90" y="${chartTop - 48}" fill="var(--accent)" font-size="12" font-family="var(--font-mono)" letter-spacing="2">${escapeXml((state.unit || 'ОТНОСИТЕЛЬНАЯ ВЕЛИЧИНА').toUpperCase())}</text>
    ${bars}
    <line x1="90" y1="${chartBottom + 70}" x2="1110" y2="${chartBottom + 70}" stroke="var(--line)" stroke-width="1"/>
    <text x="90" y="${chartBottom + 103}" fill="var(--muted)" font-size="13" font-family="var(--font-mono)">SOURCE / ${escapeXml(state.label.toUpperCase())}</text>
    <text x="1110" y="${chartBottom + 103}" fill="var(--accent)" text-anchor="end" font-size="13" font-family="var(--font-mono)">DATA POSTCARD / 01</text>
  </g>`;
}

function render() {
  updateText();
  renderPlaceholder();
}

function loadSample(name) {
  const sample = SAMPLES[name] || SAMPLES.reading;
  Object.assign(state, sample, { sample: name, categoryKey: sample.headers[0], valueKey: sample.headers[1], dateKey: sample.headers.includes('дата') ? 'дата' : '' });
  syncColumns();
  render();
  $('render-status').textContent = `Загружен набор · ${sample.label}`;
}

function bind() {
  const textBindings = [['title-input', 'title'], ['caption-input', 'caption'], ['unit-input', 'unit']];
  textBindings.forEach(([id, key]) => $(id).addEventListener('input', (event) => { state[key] = event.target.value; render(); }));
  [['mode-select', 'mode'], ['order-select', 'order'], ['theme-select', 'theme'], ['size-select', 'size'], ['category-select', 'categoryKey'], ['value-select', 'valueKey'], ['date-select', 'dateKey']].forEach(([id, key]) => $(id).addEventListener('change', (event) => { state[key] = event.target.value; render(); }));
  $('missing-toggle').addEventListener('change', (event) => { state.showMissing = event.target.checked; render(); });
  document.querySelectorAll('[data-sample]').forEach((button) => button.addEventListener('click', () => loadSample(button.dataset.sample)));

  const dropZone = $('drop-zone');
  const fileInput = $('file-input');
  const openPicker = () => fileInput.click();
  $('import-button').addEventListener('click', openPicker);
  dropZone.addEventListener('click', openPicker);
  dropZone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); } });
  ['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
  fileInput.addEventListener('change', () => { if (fileInput.files?.length) $('render-status').textContent = 'Файл выбран · импорт подключается'; });
  $('paste-button').addEventListener('click', () => { $('render-status').textContent = 'Текст выбран · импорт подключается'; });
}

document.addEventListener('DOMContentLoaded', () => {
  syncColumns();
  bind();
  render();
});

window.DataPostcard = { state, samples: SAMPLES, render, loadSample };
