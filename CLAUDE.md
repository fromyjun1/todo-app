# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The app is implemented (`index.html`, `style.css`, `app.js`) from `PRD.md` (Korean, Draft v1). There is no build, lint, or test tooling. Where the code deliberately differs from the PRD: localStorage key is `"todos"` (not `todo-app:v1`) holding a bare array, items use `completed` (not `done`), the active filter is in-memory only (not persisted), and completed items sort below incomplete ones.

Auto-categorization: typing in the add input pre-selects the category dropdown via `classifyText()` using `CATEGORY_KEYWORDS` in `app.js` (most keyword matches wins; no match or a tie leaves the dropdown unchanged). Once the user changes the dropdown manually, auto-selection stops for that item and resets after adding. It only applies to the add form, not inline edit.

## Constraints (from the PRD)

- Plain HTML + CSS + Vanilla JS (ES6+) only. No frameworks, no build tools, no backend, no external libraries.
- "Run" = open `index.html` directly in a browser (no server). There are no build/lint/test commands; verify manually against the PRD §8 acceptance criteria.
- Planned files: `index.html`, `style.css`, `app.js` at the repo root.
- UI text is Korean. Categories are fixed: `work`/`personal`/`study` (displayed 업무/개인/공부); filter values are `all` plus those three.

## Architecture (planned, PRD §7)

- Single state object `{ todos, filter }`; flow is always **event → state mutation → `save()` → `render()`**. `render()` redraws everything (list, progress, filter tabs) from state.
- Persistence: `localStorage` key `todo-app:v1`, stored shape `{ version: 1, filter, todos: [{ id, text, category, done, createdAt }] }`. `load()`/`save()` must be wrapped in try/catch: corrupt JSON → start empty; storage unavailable → show a "저장이 되지 않을 수 있습니다" warning.
- One delegated listener (click/dblclick/keydown) on the `<ul>` rather than per-item listeners.
- Progress (overall and per-category) is always computed over all todos, independent of the active filter; with 0 todos show the "할 일을 추가해보세요" empty message instead of a percentage (avoid NaN).
- Security: render user text via `textContent`, never inject user input into `innerHTML`.
- Behavior details easy to miss: new items append to the bottom; max text length 100; blank/whitespace input is rejected; delete uses `confirm`; inline edit saves on Enter and cancels on Esc; the selected filter and last-used category persist; completed items stay in place (no reordering).
