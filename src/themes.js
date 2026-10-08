/**
 * The small palette used by the postcard scene.  Values are deliberately
 * solid inks so the exported SVG still reads well on a cheap printer.
 */
export const THEMES = {
  // Keep the historic theme names because they are part of the UI contract.
  night: {
    label: 'Ночной атлас',
    bg: '#252b21',
    paper: '#252b21',
    ink: '#f7f3e8',
    muted: '#c4c8bb',
    line: '#596254',
    accent: '#ba492e',
    accentAlt: '#697546',
    soft: '#697546',
  },
  paper: {
    label: 'Бумажная статистика',
    bg: '#eee9dc',
    paper: '#f7f3e8',
    ink: '#252b21',
    muted: '#65695d',
    line: '#d7d5c7',
    accent: '#697546',
    accentAlt: '#ba492e',
    soft: '#697546',
  },
  court: {
    label: 'Спортплощадка',
    bg: '#e7e8dd',
    paper: '#f1f2e8',
    ink: '#252b21',
    muted: '#5f6b57',
    line: '#c7cbbd',
    accent: '#697546',
    accentAlt: '#ba492e',
    soft: '#4e6c63',
  },
  archive: {
    label: 'Архив',
    bg: '#e9e1d5',
    paper: '#f4ede2',
    ink: '#252b21',
    muted: '#6d695f',
    line: '#d0c7b9',
    accent: '#35566e',
    accentAlt: '#ba492e',
    soft: '#697546',
  },
  ink: {
    label: 'Чёрно-белая печать',
    bg: '#ffffff',
    paper: '#ffffff',
    ink: '#111111',
    muted: '#454545',
    line: '#c8c8c8',
    accent: '#111111',
    accentAlt: '#555555',
    soft: '#777777',
  },
};
