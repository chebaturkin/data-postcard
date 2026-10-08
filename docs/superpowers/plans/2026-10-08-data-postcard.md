# Data Postcard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, offline-first GitHub Pages tool that turns 5–20 CSV/JSON rows into a polished visual postcard with four render modes and PNG/SVG/standalone HTML export.

**Architecture:** A vanilla app split by responsibility: parser/normalizer, render scene generator, export helpers, and UI controller. The preview and exports share one SVG scene model so visuals stay identical. App state is plain serializable JSON and can be embedded in standalone HTML.

**Tech Stack:** HTML, CSS, ES modules, SVG, Canvas export, native FileReader/Blob/download APIs, Playwright smoke tests, no runtime dependencies.

---

### Task 1: Create the static app shell and design tokens

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `src/app.js`
- Create: `src/styles.css` (if styles are split during implementation)
- Modify: `README.md`

- [ ] **Step 1: Add semantic HTML shell** with header, postcard stage, data input area, settings rail, error region, export buttons, and live status.
- [ ] **Step 2: Add CSS tokens and responsive layout** for 1200×900 and Stories preview, four theme palettes, serif/sans/mono font stacks, texture patterns, focus states, reduced-motion media query, print-safe colors.
- [ ] **Step 3: Add app bootstrap** that loads a built-in sample dataset and renders a placeholder postcard.
- [ ] **Step 4: Open the page locally** and verify the stage dominates the layout at desktop and stacks before controls on mobile.
- [ ] **Step 5: Commit** with `git add index.html styles.css src && git commit -m "feat: add postcard app shell"`.

### Task 2: Implement parsing, inference, and validation

**Files:**
- Create: `src/data.js`
- Create: `tests/data.test.mjs`
- Modify: `src/app.js`

- [ ] **Step 1: Write failing tests** for quoted CSV parsing, JSON array parsing, type inference, duplicate headers, invalid numbers, mixed dates, missing values, and row-count bounds.
- [ ] **Step 2: Run the tests** with `node --test tests/data.test.mjs` and confirm failures before implementation.
- [ ] **Step 3: Implement `parseCsv`, `parseJson`, `inferColumns`, `validateDataset`, and `normalizeDataset`** returning `{headers, rows, columns, warnings, errors}`; preserve missing values as `null`.
- [ ] **Step 4: Wire file drop, file picker, and textarea parsing** into the app; show row/column-specific errors and keep the last valid render.
- [ ] **Step 5: Re-run tests** and confirm all parser tests pass.
- [ ] **Step 6: Commit** with `git add src/data.js src/app.js tests/data.test.mjs && git commit -m "feat: parse and validate small datasets"`.

### Task 3: Build the shared SVG scene and four modes

**Files:**
- Create: `src/scene.js`
- Create: `src/themes.js`
- Modify: `src/app.js`
- Modify: `styles.css`

- [ ] **Step 1: Add theme tokens** for night atlas, paper statistics, sports court, archive, plus ink-safe monochrome values and line/dot texture defs.
- [ ] **Step 2: Implement scene helpers** for text, rules, labels, hatch marks, and numeric formatting.
- [ ] **Step 3: Implement four renderers** `renderBars`, `renderDots`, `renderCalendar`, and `renderTimeline` with bounded margins and direct labels.
- [ ] **Step 4: Select a sensible default mode** from inferred columns while preserving manual mode choice.
- [ ] **Step 5: Render the live title, caption, units, ordering, theme, and missing-value key** into the same SVG scene.
- [ ] **Step 6: Verify each mode with the built-in samples and commit** with `git add src/scene.js src/themes.js src/app.js styles.css && git commit -m "feat: render four postcard modes"`.

### Task 4: Add compact controls and accessible interactions

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `styles.css`

- [ ] **Step 1: Add controls** for title, caption, unit, category/value/date columns, mode, sort order, theme, output size, and missing-value visibility.
- [ ] **Step 2: Bind controls to serializable state** and re-render on input/change without losing data.
- [ ] **Step 3: Add keyboard/focus behavior** for drop zone and buttons; expose status/error text via `aria-live`.
- [ ] **Step 4: Add sample dataset selectors** for reading, weather, and sport; show an empty/error state when no valid rows remain.
- [ ] **Step 5: Verify tab order and reduced-motion behavior** and commit with `git add index.html src/app.js styles.css && git commit -m "feat: add postcard controls and accessible states"`.

### Task 5: Implement offline exports

**Files:**
- Create: `src/export.js`
- Modify: `src/app.js`
- Modify: `index.html`
- Create: `tests/export.test.mjs`

- [ ] **Step 1: Write failing tests** for SVG serialization, dimensions, data URI/blob creation, and standalone HTML embedding.
- [ ] **Step 2: Implement `exportSvg`, `exportPng`, and `exportStandaloneHtml`** using the current SVG scene and serializable state; PNG rasterizes SVG at the selected dimensions.
- [ ] **Step 3: Add download handlers** and clear disabled/error states when no valid render exists.
- [ ] **Step 4: Run tests** with `node --test tests/export.test.mjs`; confirm all pass.
- [ ] **Step 5: Manually open exported HTML from disk** and verify it renders without network access.
- [ ] **Step 6: Commit** with `git add src/export.js src/app.js index.html tests/export.test.mjs && git commit -m "feat: export postcard as png svg and html"`.

### Task 6: Document datasets and verification

**Files:**
- Modify: `README.md`
- Create: `examples/reading.csv`
- Create: `examples/weather.json`
- Create: `examples/sport.csv`
- Create: `examples/reading-result.svg`
- Create: `examples/weather-result.svg`
- Create: `examples/sport-result.svg`
- Create: `tests/smoke.mjs`

- [ ] **Step 1: Add three small datasets** matching the UI samples.
- [ ] **Step 2: Export three representative SVG result images** and reference them in the README with local links and short notes.
- [ ] **Step 3: Document GitHub Pages deployment** and the privacy/offline behavior.
- [ ] **Step 4: Add Playwright smoke coverage** for load, import, mode switching, title edit, theme/size switching, and export download presence.
- [ ] **Step 5: Run parser/export tests plus the browser smoke test** at desktop and mobile widths.
- [ ] **Step 6: Commit** with `git add README.md examples tests/smoke.mjs && git commit -m "docs: add examples and verification coverage"`.

### Task 7: Final verification

**Files:**
- Modify only files needed for fixes found during verification.

- [ ] **Step 1: Start a local static server** and run the complete Playwright smoke suite.
- [ ] **Step 2: Inspect screenshots** at desktop 1440×1000 and mobile 390×844 for clipping, contrast, and control order.
- [ ] **Step 3: Validate keyboard-only flow, reduced-motion CSS, and monochrome print preview.**
- [ ] **Step 4: Fix any discovered issues and rerun the full suite.**
- [ ] **Step 5: Commit final fixes** with `git add -A && git commit -m "fix: polish postcard verification findings"`.

