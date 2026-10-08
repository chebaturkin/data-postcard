# Data Postcard — quality polish design

## Goal

Make the existing local Data Postcard tool dependable in daily use and visually coherent across themes, without adding server features, accounts, or decorative UI. A failed import must never replace a valid postcard, and every control must have a clear purpose.

## Decisions

- Keep the current vanilla HTML/CSS/ES module architecture and shared SVG scene.
- Treat validation errors as a failed import. The previous valid dataset and preview remain active; the input panel reports what needs fixing.
- Preserve duplicate source columns long enough to report them accurately. Normalized keys gain a stable suffix only when needed, so no cell disappears before validation.
- Add an explicit source mode to `parseText` so pasted data and files share the same parser but can report their own constraints.
- Automatic mode selection prefers timeline/calendar only when both a date and numeric column exist; otherwise it falls back to bars or dots.
- Keep copy short and in Russian. Technical mode/source identifiers never appear in visible statuses.
- Consolidate theme tokens into one CSS block, fix night contrast, and raise interactive hit areas to 44px without introducing pills, gradients, or dashboard patterns.
- Exports use the current valid scene only. PNG failures surface a status message instead of failing silently.

## Data flow

`parseText(text, filename, options)` chooses CSV or JSON, normalizes source headers and rows, validates row count/types, and returns `{ dataset, errors, warnings }`. `dataset` is non-null only when there are no blocking errors. The UI keeps `state.dataset` unchanged on a failed read or paste. Successful imports reset column selections and choose a compatible default mode.

## UI behavior

The rail stays in the order Данные → Текст → Представление → Палитра и формат → Примеры → Сохранить. Error copy is concise and capped in the panel, while the last valid postcard remains visible. Statuses use labels such as «полосы», «временной маршрут», «вставленные строки» and «погода». Export controls are disabled when no valid scene exists and report failures through the live status line.

## Verification

Add unit coverage for invalid imports, duplicate-after-cleaning headers, malformed quoted CSV, compatible mode selection, and stable state on failed imports. Run the existing node suite plus a browser smoke pass at desktop/mobile widths, all themes, all modes, and all three exports. Check keyboard focus, 44px hit areas, and reduced-motion/print rules.
