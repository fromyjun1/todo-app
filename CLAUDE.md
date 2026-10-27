# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two front-ends share one script. There is no build, lint, or test tooling; "run" = open the HTML file directly in a browser.

- `index.html` + `style.css` + `app.js` — original single-card, mobile-first layout.
- `web_version/index.html` + `style.css` + `script.js` — desktop layout (sidebar + main list).
- **`app.js` and `web_version/script.js` must stay byte-identical.** Edit one, then copy it to the other (`cp web_version/script.js app.js`). Both HTML files must keep the same element ids, because the script looks everything up by id.
- `web_version/index.html` differs structurally from the root one on purpose: `<main>` comes **before** `<aside class="sidebar">` in the DOM (so Tab reaches the input early) and CSS `order: -1` shows the sidebar first; the add-form is `position: sticky`; the input has `autofocus`; there is a skip link; backup + category management live inside one collapsed `<details id="category-manager">` so the sidebar fits laptop screens (≥ 1280×720) without an inner scrollbar. Don't "fix" these by reordering the DOM or un-nesting the buttons.
- `PRD.md` (Korean) is the original spec; §10 (v2 ideas) is now implemented. The code deliberately differs from the PRD in places: storage keys, `completed` instead of `done`, and the filter is in-memory only.

Constraints: plain HTML/CSS/vanilla JS only (no frameworks, libraries, build step, backend). UI text is Korean.

## Architecture (`app.js` / `script.js`)

- State is module-level: `categories`, `todos` (array order = user-defined order), plus UI-only `selectedDate`, `filter`, `editingId` (never persisted). Flow is always **event → state mutation → `saveTodos()`/`saveCategories()` → `render()`**; `render()` redraws the list/progress/date nav from state. Filter buttons, the category `<select>`, and the category manager are only rebuilt when `categorySignature()` changes, so keyboard focus survives re-renders; `captureFocus()`/`restoreFocus()` handle the rebuilt list.
- Storage (`localStorage`): `todos` = array of `{id, text(1-100), category, completed, createdAt, date: 'YYYY-MM-DD'}`; `todo-categories` = array of `{id, label(≤10), hue(0-360)}`; `theme` = `'light' | 'dark'`. Everything read from storage or an imported file goes through `sanitizeTodos` / `sanitizeCategories` (drops invalid entries, maps unknown categories to the first one, derives a missing `date` from `createdAt`) — corrupt data must never break startup.
- Default categories have ids `work`/`personal`/`study`; custom ones get generated ids. At most 8, at least 1. A category in use by any todo cannot be deleted.
- Dates: the list shows only `selectedDate`'s todos; progress is computed over that day (not the category filter). Adding always targets today (jumps there if viewing another day). "Carry over" copies a past day's incomplete items to today (never moves them). "Clear completed" only affects the viewed day.
- Reordering: drag-and-drop (HTML5, mouse) plus ArrowUp/ArrowDown on the focused `.drag-handle` button. Only allowed within the same completed/incomplete group and day, because the list always renders incomplete items first. Native drag-and-drop does not work on touch screens.
- Auto-categorization: typing in the add input pre-selects the category via `classifyText()` (`CATEGORY_KEYWORDS` for defaults; a custom category's own name is its keyword). Most matches wins; none or a tie leaves the dropdown alone; a manual dropdown change stops it until the item is added.
- Backup: export downloads `{app, version: 2, exportedAt, categories, todos}`; import validates, confirms, then **replaces** all data. A bare array of todos (older format) is also accepted. Max 5MB.
- Theme: CSS variables on `:root`, overridden by `[data-theme="dark"]` and by `@media (prefers-color-scheme: dark)` when no choice is stored. Category colors use `--h` (hue, set inline per element from JS) combined with per-theme saturation/lightness tokens. A tiny inline script in each HTML `<head>` applies the stored theme before first paint.
- Shortcuts / focus: pressing `/` anywhere (outside text fields) focuses the add input. After re-rendering, `restoreFocus()` only scrolls to the refocused control when it was focused via keyboard (`:focus-visible`), so a mouse click on a checkbox doesn't make the page jump when the item moves; `html { scroll-padding-top }` in `web_version/style.css` keeps focused rows from hiding under the sticky form.
- Security: all user text is rendered with `textContent`/`setAttribute`; never use `innerHTML` for user input.
- Keyboard details: inline edit saves on Enter / cancels on Esc and ignores Enter during Korean IME composition (`e.isComposing`); `aria-label`s include the item text.
