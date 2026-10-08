# Data Postcard — design specification

## Purpose

A local, static GitHub Pages tool that turns a small CSV/JSON dataset into one expressive visual postcard. The product should make data feel like a personal field note: one large visual first, compact controls second.

## Scope and constraints

- Vanilla HTML, CSS, and JavaScript. No server, account, API key, chart API, AI model, or database.
- Input never leaves the browser. Support drag-and-drop CSV/JSON, file picker, and pasted 5–20 rows.
- Target datasets are intentionally small; do not attempt broad Excel compatibility.
- Export PNG, SVG, and standalone HTML. Formats: 1200×900 (default) and Stories 1080×1920.
- Four visual modes: bars, dots, calendar grid, timeline route.
- Four limited themes: night atlas, paper statistics, sports court, archive.
- No gradients, glassmorphism, pill controls, bubbles, bento layouts, SaaS dashboard patterns, or oversized hero/CTA.

## User journey

1. Open with a preloaded sample dataset and a finished 1200×900 postcard so the value is immediately visible.
2. Drop a CSV/JSON file or paste 5–20 rows.
3. The parser inspects headers and values, classifies category/number/date columns, and reports errors in plain language.
4. The app chooses the most suitable mode but exposes all four modes.
5. User edits title, caption, units, ordering, theme, and output size.
6. User exports PNG, SVG, or standalone HTML. Export is generated entirely client-side.

## Layout and visual system

- Two-column desktop layout: postcard stage (dominant) and compact settings rail. On mobile, stage precedes controls.
- Display serif for title and labels: `Fraunces`, then `Source Serif 4`, then local serif fallback. Humanist sans/mono for controls and values: `IBM Plex Sans` and `IBM Plex Mono`, then local fallback.
- Paper-like solid surfaces with subtle line/dot texture implemented as SVG patterns or CSS backgrounds; no gradient fills.
- Theme tokens use 3–5 colors each and include a high-contrast/ink mode for black-and-white printing.
- Focus rings, keyboard-operable controls, `prefers-reduced-motion` handling, and adequate contrast are required.

## Data model and parsing

- Normalized rows are objects keyed by headers; preserve original values for export metadata.
- CSV parser handles quoted commas, newlines in quotes, UTF-8 text, and BOM. JSON accepts an array of objects or an object containing one array field.
- Type inference uses non-empty samples: date (ISO/common localized dates), number (commas/spaces as thousands separators and decimal point/comma), category/text.
- Validation surfaces: empty file, fewer than 5 or more than 20 rows for pasted mode, missing headers, duplicate headers, inconsistent row length, invalid numbers, and mixed/unparseable dates. Errors identify the column and row where possible.
- Missing values remain missing and are rendered as a hatch/mark with a legend; they do not silently become zero.

## Visualization modes

- **Bars**: one category and one numeric column; horizontal bars with direct labels and a restrained axis.
- **Dots**: one category and one numeric column; a field of indexed dots, useful for counts or ratings.
- **Calendar grid**: date column plus numeric or category value; month/day cells with ink density or hatch marks, no heatmap gradients.
- **Timeline route**: date column plus numeric value; connected route with hand-drawn line treatment, date ticks, and annotated peaks.

Each mode renders to the same internal SVG scene graph so preview and exports stay identical.

## Editing controls

- Title, caption, unit text, data column selection, sort order (input/ascending/descending), mode, theme, size, and toggle for showing missing values.
- Settings are grouped in short labeled sections with compact native controls; no pill-shaped buttons.
- Preset dataset buttons make the README examples discoverable in the UI without adding onboarding complexity.

## Export and privacy

- SVG export serializes the scene with embedded text styles and pattern definitions.
- PNG export rasterizes the SVG at the chosen dimensions with a white/ink-safe background.
- Standalone HTML export embeds normalized data, current settings, CSS, and a minimal renderer so it works offline when opened from disk.
- No network requests are required at runtime. External fonts are not required for functionality; local fallbacks keep exports self-contained.

## Error and empty states

- Empty initial state is replaced by a sample postcard, with a clear replace/import action.
- Parse errors appear adjacent to the input area and in a concise summary line above controls.
- Export is disabled only when there is no valid renderable dataset; the reason is stated in text.
- Missing/invalid values use a visible key and do not break the rest of the postcard.

## Verification plan

- Unit-level browser checks for CSV/JSON parsing, type inference, duplicate/missing validation, and sort ordering.
- Playwright smoke flow: load sample, drop/paste data, switch all four modes, edit title, toggle themes/sizes, export SVG/PNG/HTML, verify downloads and offline standalone HTML.
- Visual checks at desktop and narrow mobile widths, keyboard tab order/focus, reduced motion, and monochrome print-style preview.

## Out of scope

Large-file streaming, formulas, joins, multiple datasets, server persistence, accounts, remote URL ingestion, authentication, collaborative editing, and AI-generated commentary.
