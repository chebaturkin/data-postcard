import { t, getLocale, localeTag, mountLocale, translateMessage, setLocale } from '../i18n.js';
/**
 * The small palette used by the postcard scene.  Values are deliberately
 * solid inks so the exported SVG still reads well on a cheap printer.
 */
export const THEMES = {
  // Keep the historic theme names because they are part of the UI contract.
  night: {
    get label() { return t("s121"); },
    bg: '#252b21',
    paper: '#252b21',
    ink: '#f7f3e8',
    muted: '#c4c8bb',
    line: '#596254',
    accent: '#d28a68',
    accentAlt: '#b2bf8f',
    soft: '#b2bf8f',
  },
  paper: {
    get label() { return t("s122"); },
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
    get label() { return t("s123"); },
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
    get label() { return t("s124"); },
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
    get label() { return t("s125"); },
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
