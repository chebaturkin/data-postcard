import { dictionaries, t, getLocale, localeTag, mountLocale, translateMessage, setLocale } from '../i18n.js';
function samples(language = getLocale()) { const t = key => dictionaries[language][key]; return {
  reading: { get title() { return t("s126"); }, get caption() { return t("s127"); }, get unit() { return t("s128"); }, mode: 'bars', summary: 'total', theme: 'paper', headers: [t("s129"), t("s130")], rows: [[t("s131"), 32], [t("s132"), 48], [t("s133"), 26], [t("s134"), 61], [t("s135"), 42], [t("s136"), 76], [t("s137"), 53]] },
  expenses: { get title() { return t("s138"); }, get caption() { return t("s139"); }, unit: '₽', mode: 'bars', summary: 'total', theme: 'archive', headers: [t("s140"), t("s141")], rows: [[t("s142"), 18400], [t("s143"), 6200], [t("s144"), 3800], [t("s145"), 8500], [t("s146"), 1900], [t("s147"), 2400]] },
  content: { get title() { return t("s148"); }, get caption() { return t("s149"); }, unit: '', mode: 'dots', summary: 'total', theme: 'court', headers: [t("s150"), t("s151")], rows: [['telegram', 18], ['youtube', 4], [t("s152"), 6], [t("s153"), 4], [t("s154"), 2]] },
  weather: { get title() { return t("s155"); }, get caption() { return t("s156"); }, unit: '°C', mode: 'timeline', summary: 'average', theme: 'archive', headers: [t("s157"), t("s158")], rows: [['2026-10-02', 11], ['2026-10-03', 13], ['2026-10-04', 8], ['2026-10-05', 7], ['2026-10-06', 10], ['2026-10-07', 12], ['2026-10-08', 9]] },
  sport: { get title() { return t("s159"); }, get caption() { return t("s160"); }, get unit() { return t("s161"); }, mode: 'timeline', summary: 'total', theme: 'night', headers: [t("s157"), t("s162")], rows: [['2026-09-28', 4], ['2026-09-29', 6], ['2026-09-30', 5], ['2026-10-01', 8], ['2026-10-02', 7], ['2026-10-03', 10], ['2026-10-04', 9]] },
}; }
export const SAMPLES = new Proxy({}, { get: (_, key) => samples()[key], ownKeys: () => Object.keys(samples()), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });

export function sampleForLocale(name, language) { return samples(language)[name]; }
