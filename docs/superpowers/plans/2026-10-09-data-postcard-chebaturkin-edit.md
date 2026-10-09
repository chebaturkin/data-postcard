# Data Postcard Chebaturkin Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** привести Data Postcard к ясному строчному стилю Тимофея, укрепить импорт/экспорт и доступность, подготовить статическую публикацию на GitHub Pages и проверить результат.

**Architecture:** сохранить ванильную архитектуру и общий SVG-сценограф: `src/data.js` отвечает за входные данные, `src/app.js` — за состояние и UI, `src/scene.js` — за открытку, `src/export.js` — за скачивание. Копирайт хранится рядом с контролами и статусами, а Pages-конфигурация остаётся отдельными статическими файлами.

**Tech Stack:** HTML, CSS, ES modules, SVG, Canvas, Node test runner, GitHub Actions Pages.

---

### Task 1: зафиксировать словарь интерфейса и сообщения

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `src/data.js`
- Modify: `src/scene.js`
- Modify: `src/themes.js`
- Modify: `src/app-state.js`
- Test: `tests/app-state.test.mjs`
- Test: `tests/data.test.mjs`

- [ ] **Step 1: написать проверки для пользовательских строк.** Добавить тесты, которые проверяют, что `modeLabel('bars')`, `sourceLabel('sample reading')` и новые сообщения импорта возвращают строчные формулировки, а технические имена `CSV`, `JSON`, `PNG`, `SVG`, `HTML` не меняются.
- [ ] **Step 2: запустить точечные тесты и увидеть ожидаемый регресс.** Выполнить `node --test tests/app-state.test.mjs tests/data.test.mjs`; новые проверки должны падать на текущих заглавных сообщениях.
- [ ] **Step 3: заменить видимые строки.** В `index.html` перевести заголовки секций, подписи полей, подсказки, статусы, варианты select, privacy-note и footer на строчные начала; оставить бренды и аббревиатуры в нормативном регистре. В `src/app.js` заменить статусы загрузки/экспорта и дефолтные тексты на формулировки «действие → результат». В `src/data.js` и `src/scene.js` переписать ошибки и пустые состояния так, чтобы они сразу называли исправление.
- [ ] **Step 4: убрать технические идентификаторы из UI.** В `sourceLabel` локализовать встроенные наборы и вставку, а в `modeLabel` оставить только русские пользовательские названия; не выводить `sample reading`, `pasted data`, `bars` и `LANDSCAPE` как видимый текст.
- [ ] **Step 5: повторно запустить тесты.** Выполнить `npm test`; все существующие и новые проверки должны пройти.
- [ ] **Step 6: закоммитить словарь.** Выполнить `git add index.html src/app.js src/data.js src/scene.js src/themes.js src/app-state.js tests && git commit -m "copy: align postcard interface with chebaturkin voice"`.

### Task 2: укрепить импорт и состояние приложения

**Files:**
- Modify: `src/app.js`
- Modify: `src/data.js`
- Test: `tests/data.test.mjs`
- Test: `tests/app-state.test.mjs`

- [ ] **Step 1: написать падающие тесты для ограничений входа.** Покрыть экспортированными чистыми helpers проверку расширения (`.csv`, `.json`), лимит размера файла и безопасную обработку отсутствующего `file`; добавить тест, что невалидный импорт не заменяет активный набор.
- [ ] **Step 2: запустить тесты до реализации.** Выполнить `node --test tests/data.test.mjs tests/app-state.test.mjs`; новые тесты должны падать на отсутствующих helpers.
- [ ] **Step 3: добавить контракт импорта.** В `src/app.js` определить константу `MAX_FILE_BYTES = 1024 * 1024` и чистые helpers `isSupportedFile(file)` и `fileImportError(file)`. Проверять расширение/`type` и размер до `file.text()`, показывать «поддерживаются CSV и JSON до 1 МБ» и очищать input.
- [ ] **Step 4: сохранить последнюю открытку.** Оставить замену `state.dataset` только внутри успешного `loadDataset`; на ошибке обновлять `showErrors` и `render-status`, не трогая `state.svg` и export-кнопки.
- [ ] **Step 5: проверить строки и форматы.** Убедиться, что JSON с несколькими массивами, дублирующимися заголовками, неверными числами/датами и строками вне диапазона получает конкретную ошибку, а лишние пользовательские значения не попадают в `innerHTML` без экранирования.
- [ ] **Step 6: запустить полный набор и закоммитить.** Выполнить `npm test`, затем `git add src/app.js src/data.js tests && git commit -m "fix: guard imports and preserve valid postcard"`.

### Task 3: выровнять доступность и визуальный стиль

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/scene.js`

- [ ] **Step 1: исправить семантику перехода к предпросмотру.** Добавить `tabindex="-1"` и точное имя области на `#postcard-stage`, обновить начальные `title/desc`, убрать лишние англоязычные метки и сделать labels понятными без CSS.
- [ ] **Step 2: синхронизировать токены.** Использовать одну пару `Literata`/`Golos Text` с локальными fallback в CSS и SVG, убрать принудительный `text-transform: uppercase` с пользовательских строк, оставить mono только для чисел и коротких технических подписей.
- [ ] **Step 3: выровнять темы.** Сохранить 3–5 сплошных цветов на тему, проверить контраст ночной темы, состояния hover/focus/disabled и print-preview; не добавлять градиенты, стекло, pill-формы или новые декоративные блоки.
- [ ] **Step 4: проверить мобильные ограничения.** Настроить перенос длинных заголовков, ширину Stories, отступы mobile и минимальную высоту интерактивных элементов 44px.
- [ ] **Step 5: проверить вручную в браузере.** На 1440px, 768px и 390px открыть стартовый пример, переключить пять тем и Stories, пройти tab-порядок и включить `prefers-reduced-motion`.
- [ ] **Step 6: закоммитить визуальную правку.** Выполнить `git diff --check && git add index.html styles.css src/scene.js && git commit -m "style: make postcard interface quiet and lowercase"`.

### Task 4: довести экспорт и статическую публикацию

**Files:**
- Modify: `src/export.js`
- Modify: `src/app.js`
- Create: `404.html`
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`
- Test: `tests/export.test.mjs`

- [ ] **Step 1: расширить проверки экспорта.** Добавить тесты на безопасное имя файла с переводом строк/точками, пустой SVG, экранирование `</script>` и отсутствие внешних URL в standalone HTML.
- [ ] **Step 2: укрепить экспорт.** Сохранить единый `requireSvgMarkup`, гарантировать revoke object URL для PNG и показывать в UI «сохранено: SVG/PNG/HTML» или конкретную причину сбоя; не вставлять пользовательский metadata в HTML без JSON-экранирования.
- [ ] **Step 3: создать 404.** Сделать самостоятельную страницу без внешних ресурсов с коротким текстом «страница не найдена» и ссылкой на `./`, в том же регистре и с теми же локальными fallback.
- [ ] **Step 4: добавить Pages workflow.** Создать `.github/workflows/pages.yml` с `actions/configure-pages`, `actions/upload-pages-artifact` и `actions/deploy-pages`, правами `contents: read`, `pages: write`, `id-token: write`, запуском на `master` и ручным запуском.
- [ ] **Step 5: переписать README.** Описать, что делает инструмент, ограничения 5–20 строк и 1 МБ, локальную обработку, команды запуска/тестов, GitHub Pages и три примера; оставить изображения результата с относительными ссылками.
- [ ] **Step 6: запустить тесты и закоммитить.** Выполнить `npm test`, `git diff --check`, проверить YAML/HTML локально и выполнить `git add src/export.js src/app.js tests/export.test.mjs README.md 404.html .github/workflows/pages.yml && git commit -m "docs: prepare postcard for github pages"`.

### Task 5: browser smoke pass и финальный аудит

**Files:**
- Modify only files required by verification findings.
- Optional Test: `tests/smoke.mjs` if Playwright is available without adding a runtime dependency.

- [ ] **Step 1: поднять статический сервер.** Выполнить `python3 -m http.server 4174` из корня и открыть `http://127.0.0.1:4174/`.
- [ ] **Step 2: проверить основные сценарии.** Проверить стартовую открытку, чтение/погоду/спорт, четыре режима, смену колонок/порядка, темы, Stories, ручную вставку валидных и невалидных данных, сохранение прежней открытки после ошибки.
- [ ] **Step 3: проверить скачивания.** Нажать PNG, SVG и HTML, убедиться в сообщениях статуса и открыть standalone HTML с отключённой сетью или из `file://`.
- [ ] **Step 4: проверить доступность и responsive.** Проверить skip-link, видимый focus, labels, `aria-live`, отсутствие горизонтального overflow, reduced motion и print-preview.
- [ ] **Step 5: исправить найденное и повторить проверки.** Выполнить `npm test` и `git diff --check` после каждой исправленной проблемы.
- [ ] **Step 6: закоммитить финальный результат.** Выполнить `git add -A && git commit -m "fix: finish postcard audit"` только после того, как все проверки пройдут.

## Самопроверка плана

- Все разделы спецификации покрыты задачами: копирайт, регистр, визуальные токены, доступность, импорт, экспорт, GitHub Pages, README и smoke pass.
- В плане нет `TODO`, `TBD`, пустых «добавить проверки» без описания поведения или несуществующих API.
- Имена helpers и файлов согласованы между задачами: `isSupportedFile`, `fileImportError`, `requireSvgMarkup`, `pages.yml`, `404.html`.
