# Data Postcard quality polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make imports, state transitions, statuses, themes, and exports dependable while preserving the existing postcard modes and minimal design system.

**Architecture:** Keep the parser, app controller, shared SVG scene, and export helpers as separate modules. Tighten their contracts: parser returns an active dataset only when valid, the controller swaps datasets only after success, and the scene/export layers consume one serializable snapshot. CSS tokens are consolidated so theme contrast is predictable.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node test runner, browser APIs, no runtime dependencies.

---

### Task 1: Harden normalized data contracts

**Files:**
- Modify: `src/data.js`
- Test: `tests/data.test.mjs`

- [ ] Write failing tests for `parseText` returning `dataset: null` on row-count/type/duplicate errors, duplicate headers after trimming, and malformed characters after a closing CSV quote.
- [ ] Run `node --test tests/data.test.mjs` and confirm those tests fail against the current permissive behavior.
- [ ] Implement stable header keys for cleaned duplicates, source-mode options, blocking-error classification, and CSV malformed-quote reporting while preserving raw values.
- [ ] Run the data tests again and confirm the new contract plus existing parser coverage pass.

### Task 2: Make controller state transitions explicit

**Files:**
- Modify: `src/app.js`
- Test: `tests/app-state.test.mjs`

- [ ] Add small exported pure helpers for compatible default mode, source labels, and deciding whether an import can replace the active dataset; write failing tests for date-only data, numeric-only data, and failed imports.
- [ ] Run the new test file and observe failures before implementation.
- [ ] Use the helpers in `loadDataset`, `readFile`, and `handlePaste`; pass `{ source: 'file' | 'paste' }` to `parseText`, retain the previous valid dataset on errors, and localize visible mode/source labels.
- [ ] Disable export buttons when `state.svg` is empty, update the live status on import/export failures, and keep column options synchronized after a successful import.
- [ ] Run all node tests and confirm the controller helpers and parser contract pass.

### Task 3: Consolidate the visual system and touch behavior

**Files:**
- Modify: `styles.css`
- Modify: `index.html`

- [ ] Write a browser checklist for all five themes, 44px import/paste controls, mobile stacking, and Stories sizing.
- [ ] Remove the duplicate token/reset block, define one token set per theme with readable night foregrounds, and replace hard-coded light input backgrounds with token-based surfaces.
- [ ] Give text buttons explicit 44px hit areas, keep the rail readable on desktop, and add a compact max-height treatment for Stories preview while preserving the export dimensions.
- [ ] Remove nonessential metadata copy from the head and correct the initial SVG accessible label so it is valid before hydration as well as after it.
- [ ] Run a local browser smoke pass at 1440px, 768px, and 390px widths and verify there is no overflow or contrast regression.

### Task 4: Harden export feedback

**Files:**
- Modify: `src/export.js`
- Modify: `src/app.js`
- Test: `tests/export.test.mjs`

- [ ] Add failing tests for empty SVG rejection and deterministic filename sanitization.
- [ ] Implement small export helpers that reject empty markup, sanitize names, and return a promise from PNG export so callers can surface errors.
- [ ] Update app export handlers to use the current snapshot and announce success/failure through `render-status`.
- [ ] Run export and full node tests.

### Task 5: Browser verification and documentation

**Files:**
- Modify: `README.md`
- Create: `tests/smoke.mjs` only if the local Playwright runtime is available; otherwise document the manual smoke command.

- [ ] Start a static server and verify initial sample, three sample buttons, four modes, five themes, Stories, failed import retention, and all exports.
- [ ] Check keyboard-only focus and reduced-motion behavior.
- [ ] Update README with the actual validation behavior and concise user-facing workflow.
- [ ] Run the complete test command and inspect `git diff` for accidental copy or metadata regressions.

