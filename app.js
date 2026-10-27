const STORAGE_KEY = 'todos';
const CATEGORY_KEY = 'todo-categories';
const THEME_KEY = 'theme';
const MAX_LENGTH = 100;
const MAX_CATEGORIES = 8;
const MAX_CATEGORY_NAME = 10;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

// 기본 카테고리. hue는 색상(0~360)이고, 밝은/어두운 테마에 맞는 명도는 CSS가 정한다
const DEFAULT_CATEGORIES = [
  { id: 'work', label: '업무', hue: 217 },
  { id: 'personal', label: '개인', hue: 160 },
  { id: 'study', label: '공부', hue: 38 },
];

const COLOR_CHOICES = [
  { label: '파랑', hue: 217 },
  { label: '초록', hue: 160 },
  { label: '주황', hue: 38 },
  { label: '빨강', hue: 0 },
  { label: '보라', hue: 270 },
  { label: '분홍', hue: 330 },
  { label: '청록', hue: 185 },
  { label: '노랑', hue: 55 },
];

// 자동 분류용 키워드 (기본 카테고리 id 기준, 소문자 비교, 부분 일치)
// 사용자 정의 카테고리는 카테고리 이름 자체가 키워드가 된다
const CATEGORY_KEYWORDS = {
  work: [
    '회의', '미팅', '보고서', '업무', '프로젝트', '발표', '메일', '출장', '계약', '견적',
    '기획', '마감', '클라이언트', '고객', '회사', '야근', '결재', '거래처', '인수인계',
    'meeting', 'report', 'deadline', 'email', 'client', 'project',
  ],
  personal: [
    '장보기', '병원', '운동', '청소', '빨래', '세탁', '약속', '은행', '택배', '가족', '친구',
    '생일', '여행', '예약', '쇼핑', '요리', '산책', '헬스', '마트', '설거지', '미용실',
    'gym', 'shopping', 'dinner',
  ],
  study: [
    '공부', '시험', '강의', '수업', '숙제', '과제', '독서', '영어', '단어', '복습', '예습',
    '자격증', '토익', '문제집', '인강', '코딩', '암기',
    'study', 'homework', 'exam', 'lecture',
  ],
};

const themeToggleEl = document.getElementById('theme-toggle');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const todayEl = document.getElementById('today');
const formEl = document.getElementById('todo-form');
const inputEl = document.getElementById('todo-input');
const categoryEl = document.getElementById('todo-category');
const listEl = document.getElementById('todo-list');
const emptyEl = document.getElementById('empty-message');
const clearDoneEl = document.getElementById('clear-done');
const progressTitleEl = document.getElementById('progress-title');
const progressTextEl = document.getElementById('progress-text');
const progressBarEl = document.getElementById('progress-bar');
const progressFillEl = document.getElementById('progress-fill');
const progressCategoriesEl = document.getElementById('progress-categories');
const filterListEl = document.getElementById('filter-list');
const datePrevEl = document.getElementById('date-prev');
const dateNextEl = document.getElementById('date-next');
const dateTodayEl = document.getElementById('date-today');
const dateInputEl = document.getElementById('date-input');
const dateLabelEl = document.getElementById('date-label');
const carryOverEl = document.getElementById('carry-over');
const categoryFormEl = document.getElementById('category-form');
const categoryNameEl = document.getElementById('new-category-name');
const categoryColorEl = document.getElementById('new-category-color');
const categoryListEl = document.getElementById('category-list');
const exportEl = document.getElementById('export-btn');
const importEl = document.getElementById('import-btn');
const importFileEl = document.getElementById('import-file');

// ---------- 날짜 ----------

function pad(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toDateStr(parseDate(s)) === s;
}

function todayStr() {
  return toDateStr(new Date());
}

function shiftDate(s, days) {
  const d = parseDate(s);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function formatDate(s, withYear) {
  return parseDate(s).toLocaleDateString('ko-KR', {
    year: withYear ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

// ---------- 데이터 검증 / 저장 ----------

function cloneDefaults() {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
}

// 카테고리 배열을 검증한다. 잘못된 항목은 버리고 중복 id는 첫 번째만 남긴다
function sanitizeCategories(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const result = [];
  arr.forEach((c) => {
    if (!c || typeof c.id !== 'string' || !c.id || c.id.length > 40 || seen.has(c.id)) return;
    if (typeof c.label !== 'string') return;
    const label = c.label.trim();
    if (label.length < 1 || label.length > MAX_CATEGORY_NAME) return;
    if (typeof c.hue !== 'number' || !Number.isFinite(c.hue)) return;
    seen.add(c.id);
    result.push({ id: c.id, label, hue: ((Math.round(c.hue) % 360) + 360) % 360 });
  });
  return result.slice(0, MAX_CATEGORIES);
}

// 할 일 배열을 검증한다. 없는 카테고리는 첫 카테고리로, 날짜가 없으면 생성 시각의 날짜로 채운다
function sanitizeTodos(arr, cats) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const result = [];
  arr.forEach((t) => {
    if (!t || typeof t.id !== 'string' || !t.id || seen.has(t.id)) return;
    if (typeof t.text !== 'string') return;
    const text = t.text.trim();
    if (text.length < 1 || text.length > MAX_LENGTH) return;
    if (typeof t.completed !== 'boolean' || !Number.isFinite(t.createdAt)) return;
    seen.add(t.id);
    result.push({
      id: t.id,
      text,
      category: cats.some((c) => c.id === t.category) ? t.category : cats[0].id,
      completed: t.completed,
      createdAt: t.createdAt,
      date: isValidDateStr(t.date) ? t.date : toDateStr(new Date(t.createdAt)),
    });
  });
  return result;
}

function loadCategories() {
  try {
    const cats = sanitizeCategories(JSON.parse(localStorage.getItem(CATEGORY_KEY)));
    return cats.length ? cats : cloneDefaults();
  } catch (e) {
    return cloneDefaults();
  }
}

function loadTodos() {
  try {
    return sanitizeTodos(JSON.parse(localStorage.getItem(STORAGE_KEY)), categories);
  } catch (e) {
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (e) {
    // 저장 불가 환경(시크릿 모드 등)에서도 앱은 계속 동작
  }
}

function saveCategories() {
  try {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
  } catch (e) {
    // 저장 불가 환경에서도 앱은 계속 동작
  }
}

// ---------- 상태 ----------

// 상태: categories, todos 배열 (배열 순서가 곧 사용자가 정한 순서)
let categories = loadCategories();
let todos = loadTodos();
// UI 상태 (저장하지 않음): 보고 있는 날짜 / 수정 중인 항목 id / 카테고리 필터
let selectedDate = todayStr();
let editingId = null;
let filter = 'all';
let dragId = null;

// 헤더의 오늘 날짜 표시
todayEl.dateTime = todayStr();
todayEl.textContent = formatDate(todayStr(), true);

// ---------- 테마 ----------

// 저장된 테마('light' | 'dark')가 있으면 그것, 없으면 OS 설정을 따른다
function getStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'dark' || t === 'light' ? t : null;
  } catch (e) {
    return null;
  }
}

function currentTheme() {
  return getStoredTheme() || (darkQuery.matches ? 'dark' : 'light');
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  themeToggleEl.textContent = dark ? '라이트 모드' : '다크 모드';
  themeToggleEl.setAttribute('aria-pressed', String(dark));
}

// 토글 버튼: 선택을 저장해 다음 방문에도 유지한다
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (e) {
    // 저장 불가해도 이번 세션에는 적용
  }
  applyTheme(next);
}

// ---------- 렌더링 ----------

function getCategory(id) {
  return categories.find((c) => c.id === id) || categories[0];
}

// 카테고리 색상(hue)을 CSS 변수로 넘긴다. 실제 색은 테마별로 CSS가 계산한다
function applyHue(el, cat) {
  el.style.setProperty('--h', String(cat.hue));
}

// 미완료 먼저, 완료 나중. 같은 그룹 안에서는 배열 순서 유지 (상태 배열 자체는 바꾸지 않음)
function sortedTodos(list) {
  return [...list.filter((t) => !t.completed), ...list.filter((t) => t.completed)];
}

function dayTodos() {
  return todos.filter((t) => t.date === selectedDate);
}

// 현재 화면에 보이는 항목 (선택한 날짜 + 카테고리 필터)
function visibleTodos() {
  return sortedTodos(dayTodos()).filter((t) => filter === 'all' || t.category === filter);
}

// 스크린리더가 어떤 항목인지 알 수 있도록 aria-label에 항목 내용을 포함한다
function createCheckbox(todo) {
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.className = 'todo-check';
  box.checked = todo.completed;
  box.setAttribute('aria-label', `완료 표시: ${todo.text}`);
  return box;
}

function createButton(className, label, todo) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.setAttribute('aria-label', todo ? `${label}: ${todo.text}` : label);
  btn.textContent = label;
  return btn;
}

// 드래그 손잡이: 마우스로 끌거나, 포커스한 뒤 위/아래 화살표 키로 순서를 바꾼다
function createHandle(todo) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'drag-handle';
  btn.textContent = '⋮⋮';
  btn.title = '끌어서 순서 변경 (또는 위/아래 화살표 키)';
  btn.setAttribute('aria-label', `순서 변경: ${todo.text} (위/아래 화살표 키)`);
  return btn;
}

function renderViewItem(li, todo) {
  const text = document.createElement('span');
  text.className = 'todo-text';
  text.textContent = todo.text;

  const cat = getCategory(todo.category);
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = cat.label;
  applyHue(badge, cat);

  li.append(
    createHandle(todo),
    createCheckbox(todo),
    text,
    badge,
    createButton('edit-btn', '수정', todo),
    createButton('delete-btn', '삭제', todo)
  );
}

function renderEditItem(li, todo) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-text';
  input.maxLength = MAX_LENGTH;
  input.value = todo.text;
  input.setAttribute('aria-label', '할 일 수정');

  const select = document.createElement('select');
  select.className = 'edit-category';
  select.setAttribute('aria-label', '카테고리');
  categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label;
    select.appendChild(opt);
  });
  select.value = todo.category;

  li.append(
    input,
    select,
    createButton('save-btn', '저장'),
    createButton('cancel-btn', '취소')
  );
}

function percent(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

// 진행률은 선택한 날짜의 전체 항목 기준 (카테고리 필터와 무관)
function renderProgress(day) {
  const total = day.length;
  const done = day.filter((t) => t.completed).length;
  const pct = percent(done, total);

  if (progressTitleEl) {
    progressTitleEl.textContent =
      selectedDate === todayStr() ? '오늘의 진행률' : `${parseDate(selectedDate).getMonth() + 1}월 ${parseDate(selectedDate).getDate()}일 진행률`;
  }
  progressTextEl.textContent = `${done}/${total} 완료 (${pct}%)`;
  progressFillEl.style.width = pct + '%';
  progressBarEl.setAttribute('aria-valuenow', String(pct));
  progressBarEl.setAttribute('aria-valuetext', `${done}/${total} 완료 (${pct}%)`);

  progressCategoriesEl.replaceChildren();
  categories.forEach((cat) => {
    const inCat = day.filter((t) => t.category === cat.id);
    const catDone = inCat.filter((t) => t.completed).length;
    const chip = document.createElement('span');
    chip.className = 'cat-chip';
    chip.textContent = `${cat.label} ${catDone}/${inCat.length} (${percent(catDone, inCat.length)}%)`;
    applyHue(chip, cat);
    progressCategoriesEl.appendChild(chip);
  });
}

function categorySignature() {
  return categories.map((c) => `${c.id}:${c.label}:${c.hue}`).join('|');
}

// 카테고리가 바뀐 경우에만 필터 버튼을 새로 만든다 (키보드 포커스 유지)
function renderFilters() {
  const sig = categorySignature();
  if (filterListEl.dataset.sig !== sig) {
    filterListEl.dataset.sig = sig;
    filterListEl.replaceChildren();
    [{ id: 'all', label: '전체' }, ...categories].forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter';
      btn.dataset.filter = c.id;
      btn.textContent = c.label;
      filterListEl.appendChild(btn);
    });
  }
  filterListEl.querySelectorAll('.filter').forEach((btn) => {
    const active = btn.dataset.filter === filter;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

// 입력 폼의 카테고리 선택 상자. 현재 선택값은 유지한다
function renderCategorySelect() {
  const sig = categorySignature();
  if (categoryEl.dataset.sig === sig) return;
  categoryEl.dataset.sig = sig;
  const prev = categoryEl.value;
  categoryEl.replaceChildren();
  categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label;
    categoryEl.appendChild(opt);
  });
  categoryEl.value = categories.some((c) => c.id === prev) ? prev : categories[0].id;
}

// 카테고리 관리 목록 (이름 변경 / 삭제)
function renderCategoryManager() {
  const sig = categorySignature();
  if (categoryListEl.dataset.sig === sig) return;
  categoryListEl.dataset.sig = sig;
  categoryListEl.replaceChildren();
  categories.forEach((cat) => {
    const li = document.createElement('li');
    li.dataset.id = cat.id;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = cat.label;
    applyHue(badge, cat);

    const spacer = document.createElement('span');
    spacer.className = 'spacer';

    li.append(
      badge,
      spacer,
      createButton('cat-rename', '이름 변경', { text: cat.label }),
      createButton('cat-delete', '삭제', { text: cat.label })
    );
    categoryListEl.appendChild(li);
  });
  categoryFormEl.querySelector('button[type="submit"]').disabled = categories.length >= MAX_CATEGORIES;
}

function renderDateNav(day) {
  const today = todayStr();
  const isToday = selectedDate === today;
  dateInputEl.value = selectedDate;
  dateInputEl.max = today;
  dateNextEl.disabled = selectedDate >= today;
  dateTodayEl.disabled = isToday;
  dateLabelEl.textContent = formatDate(selectedDate, true) + (isToday ? ' (오늘)' : '');

  // 지난 날짜의 미완료 항목이 있을 때만 "오늘로 가져오기"를 보여준다
  carryOverEl.hidden = isToday || !day.some((t) => !t.completed);
  inputEl.placeholder = isToday
    ? inputEl.dataset.placeholderToday || '할 일을 입력하세요...'
    : '입력하면 오늘 목록에 추가됩니다...';
}

// 다시 그리기 전에 목록 안의 포커스 위치(항목 id + 컨트롤 종류)를 기억한다
function captureFocus() {
  const active = document.activeElement;
  if (!listEl.contains(active)) return null;
  const li = active.closest('li');
  // 키보드로 조작 중일 때만 포커스를 따라 화면을 스크롤한다 (마우스로 체크할 때 화면이 튀지 않게)
  return { id: li.dataset.id, cls: active.classList[0], viaKeyboard: active.matches(':focus-visible') };
}

// 키보드 사용자가 위치를 잃지 않도록 포커스를 복원한다
function restoreFocus(saved) {
  const li = [...listEl.children].find((el) => el.dataset.id === saved.id);
  const target = li && (li.querySelector('.' + saved.cls) || li.querySelector('.edit-btn'));
  (target || inputEl).focus({ preventScroll: !saved.viaKeyboard }); // 항목이 사라졌다면(삭제) 입력창으로
}

// 전체 화면을 상태에서 다시 그린다
function render() {
  const savedFocus = captureFocus();
  const day = dayTodos();
  listEl.replaceChildren();
  let editInput = null;

  visibleTodos().forEach((todo) => {
    const li = document.createElement('li');
    li.dataset.id = todo.id;
    if (todo.completed) li.classList.add('done');

    if (todo.id === editingId) {
      li.classList.add('editing');
      renderEditItem(li, todo);
      editInput = li.querySelector('.edit-text');
    } else {
      li.draggable = true;
      renderViewItem(li, todo);
    }
    listEl.appendChild(li);
  });

  emptyEl.textContent =
    selectedDate === todayStr() ? '오늘 할 일을 추가해 보세요' : '이 날짜에는 기록이 없습니다';
  emptyEl.hidden = day.length > 0;
  renderCategorySelect();
  renderCategoryManager();
  renderDateNav(day);
  renderProgress(day);
  renderFilters();
  clearDoneEl.disabled = !day.some((t) => t.completed);

  if (editInput) {
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  } else if (savedFocus) {
    restoreFocus(savedFocus);
  }
}

// ---------- 할 일 조작 (상태 변경 → 저장 → 다시 그리기) ----------

function addTodo() {
  const text = inputEl.value.trim().slice(0, MAX_LENGTH);
  if (!text) return;

  // 새 항목은 항상 오늘 목록에 들어가므로, 다른 날짜를 보고 있었다면 오늘로 이동
  selectedDate = todayStr();
  // 다른 카테고리 필터가 켜져 있으면 새 항목이 보이도록 해당 탭으로 이동
  if (filter !== 'all') filter = categoryEl.value;

  const now = Date.now();
  todos.push({
    id: now.toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    category: categoryEl.value,
    completed: false,
    createdAt: now,
    date: selectedDate,
  });
  saveTodos();
  render();

  categoryChosenByUser = false; // 다음 항목은 다시 자동 분류
  inputEl.value = '';
  inputEl.focus();
}

function deleteTodo(id) {
  if (!confirm('이 할 일을 삭제할까요?')) return;
  todos = todos.filter((t) => t.id !== id);
  if (editingId === id) editingId = null;
  saveTodos();
  render();
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  saveTodos();
  render();
}

function startEdit(id) {
  editingId = id;
  render();
}

function cancelEdit() {
  editingId = null;
  render();
}

// 빈 내용이면 저장하지 않고(false 반환) 수정 모드를 유지한다
function updateTodo(id, rawText, category) {
  const text = rawText.trim().slice(0, MAX_LENGTH);
  if (!text) return false;
  const todo = todos.find((t) => t.id === id);
  if (!todo) return false;
  todo.text = text;
  todo.category = category;
  editingId = null;
  saveTodos();
  render();
  return true;
}

// 선택한 날짜의 완료 항목만 삭제한다
function clearCompleted() {
  if (!dayTodos().some((t) => t.completed)) return;
  if (!confirm('이 날짜의 완료된 항목을 모두 삭제할까요?')) return;
  todos = todos.filter((t) => !(t.date === selectedDate && t.completed));
  if (!todos.some((t) => t.id === editingId)) editingId = null;
  saveTodos();
  render();
  inputEl.focus(); // 눌렀던 버튼이 비활성화되므로 포커스를 입력창으로
}

function saveEditFrom(li) {
  const input = li.querySelector('.edit-text');
  const category = li.querySelector('.edit-category').value;
  if (!updateTodo(li.dataset.id, input.value, category)) input.focus();
}

// ---------- 날짜 이동 ----------

function setDate(dateStr) {
  selectedDate = dateStr;
  editingId = null;
  render();
}

// 지난 날짜의 미완료 항목을 오늘 목록으로 복사한다 (지난 기록은 그대로 둔다)
function carryOverIncomplete() {
  const today = todayStr();
  const fresh = dayTodos()
    .filter((t) => !t.completed)
    .filter((t) => !todos.some((o) => o.date === today && o.text === t.text && o.category === t.category));
  if (fresh.length === 0) {
    alert('미완료 항목이 이미 모두 오늘 목록에 있어요.');
    return;
  }
  if (!confirm(`미완료 항목 ${fresh.length}개를 오늘 목록에 추가할까요?`)) return;
  const now = Date.now();
  fresh.forEach((t, i) => {
    todos.push({
      id: (now + i).toString(36) + Math.random().toString(36).slice(2, 6),
      text: t.text,
      category: t.category,
      completed: false,
      createdAt: now + i,
      date: today,
    });
  });
  saveTodos();
  selectedDate = today;
  render();
}

// ---------- 순서 변경 ----------

// id 항목을 targetId 항목의 앞(after=false) 또는 뒤(after=true)로 옮긴다
function moveTodo(id, targetId, after) {
  const from = todos.findIndex((t) => t.id === id);
  if (from < 0 || id === targetId) return;
  const [item] = todos.splice(from, 1);
  let to = todos.findIndex((t) => t.id === targetId);
  if (to < 0) {
    todos.splice(from, 0, item);
    return;
  }
  if (after) to += 1;
  todos.splice(to, 0, item);
  saveTodos();
  render();
}

// 미완료/완료 그룹은 항상 분리되어 보이므로, 같은 그룹 안에서만 이동할 수 있다
function canReorder(idA, idB) {
  const a = todos.find((t) => t.id === idA);
  const b = todos.find((t) => t.id === idB);
  return Boolean(a && b && a.completed === b.completed && a.date === b.date);
}

// 키보드: 보이는 목록에서 바로 위/아래 항목과 자리를 바꾼다
function moveByStep(id, dir) {
  const list = visibleTodos();
  const idx = list.findIndex((t) => t.id === id);
  const neighbor = list[idx + dir];
  if (idx < 0 || !neighbor || !canReorder(id, neighbor.id)) return;
  moveTodo(id, neighbor.id, dir > 0);
}

function clearDropMarks() {
  listEl.querySelectorAll('.drop-before, .drop-after, .dragging').forEach((el) => {
    el.classList.remove('drop-before', 'drop-after', 'dragging');
  });
}

function dropAfter(e, li) {
  const rect = li.getBoundingClientRect();
  return e.clientY > rect.top + rect.height / 2;
}

// ---------- 카테고리 관리 ----------

function newCategoryId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// 이름이 올바른지 검사하고 문제가 있으면 안내 문구를 반환한다 (정상이면 null)
function validateCategoryName(name, selfId) {
  if (!name) return '카테고리 이름을 입력해 주세요.';
  if (name.length > MAX_CATEGORY_NAME) return `이름은 ${MAX_CATEGORY_NAME}자 이하로 입력해 주세요.`;
  if (categories.some((c) => c.id !== selfId && c.label.toLowerCase() === name.toLowerCase())) {
    return '같은 이름의 카테고리가 이미 있어요.';
  }
  return null;
}

function addCategory(rawName, hue) {
  const name = rawName.trim();
  if (categories.length >= MAX_CATEGORIES) {
    alert(`카테고리는 최대 ${MAX_CATEGORIES}개까지 만들 수 있어요.`);
    return false;
  }
  const problem = validateCategoryName(name, null);
  if (problem) {
    alert(problem);
    return false;
  }
  categories.push({ id: newCategoryId(), label: name, hue });
  saveCategories();
  render();
  return true;
}

function renameCategory(id) {
  const cat = categories.find((c) => c.id === id);
  if (!cat) return;
  const input = prompt('새 카테고리 이름', cat.label);
  if (input === null) return;
  const name = input.trim();
  const problem = validateCategoryName(name, id);
  if (problem) {
    alert(problem);
    return;
  }
  cat.label = name;
  saveCategories();
  render();
}

// 사용 중인 카테고리는 삭제할 수 없다 (할 일이 사라지거나 분류가 깨지는 것을 막기 위해)
function deleteCategory(id) {
  const cat = categories.find((c) => c.id === id);
  if (!cat) return;
  if (categories.length <= 1) {
    alert('카테고리는 최소 1개가 필요해요.');
    return;
  }
  const used = todos.filter((t) => t.category === id).length;
  if (used > 0) {
    alert(`"${cat.label}" 카테고리를 쓰는 할 일이 ${used}개 있어서 삭제할 수 없어요.\n해당 할 일의 카테고리를 먼저 바꾸거나 삭제해 주세요.`);
    return;
  }
  if (!confirm(`"${cat.label}" 카테고리를 삭제할까요?`)) return;
  categories = categories.filter((c) => c.id !== id);
  if (filter === id) filter = 'all';
  saveCategories();
  render();
}

// ---------- 백업 (JSON 내보내기 / 가져오기) ----------

function exportData() {
  const data = {
    app: 'todo-app',
    version: 2,
    exportedAt: new Date().toISOString(),
    categories,
    todos,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `todo-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 백업 파일 내용을 검증해 { cats, items }로 돌려준다. 형식이 틀리면 null
// 이전 버전의 백업(할 일 배열만 있는 형식)도 받아들인다
function parseBackup(obj) {
  let rawTodos;
  let cats;
  if (Array.isArray(obj)) {
    rawTodos = obj;
    cats = categories.map((c) => ({ ...c }));
  } else if (obj && typeof obj === 'object' && Array.isArray(obj.todos)) {
    rawTodos = obj.todos;
    cats = sanitizeCategories(obj.categories);
    if (cats.length === 0) cats = cloneDefaults();
  } else {
    return null;
  }
  return { cats, items: sanitizeTodos(rawTodos, cats) };
}

async function importData(file) {
  if (file.size > MAX_IMPORT_BYTES) {
    alert('파일이 너무 커요. (최대 5MB)');
    return;
  }
  let parsed;
  try {
    parsed = parseBackup(JSON.parse(await file.text()));
  } catch (e) {
    parsed = null;
  }
  if (!parsed) {
    alert('올바른 백업 파일이 아니에요.');
    return;
  }
  const ok = confirm(
    `현재 데이터를 이 파일의 내용으로 교체합니다.\n할 일 ${parsed.items.length}개, 카테고리 ${parsed.cats.length}개를 불러올까요?`
  );
  if (!ok) return;
  categories = parsed.cats;
  todos = parsed.items;
  filter = 'all';
  editingId = null;
  saveCategories();
  saveTodos();
  render();
}

// ---------- 자동 분류 ----------

// 키워드가 가장 많이 일치한 카테고리 id를 반환. 일치가 없거나 동점이면 null
function classifyText(text) {
  const lower = text.toLowerCase();
  let best = null;
  let bestScore = 0;
  let tied = false;
  categories.forEach((cat) => {
    const words = new Set([...(CATEGORY_KEYWORDS[cat.id] || []), cat.label.toLowerCase()]);
    const score = [...words].filter((w) => lower.includes(w)).length;
    if (score > bestScore) {
      best = cat.id;
      bestScore = score;
      tied = false;
    } else if (score === bestScore && score > 0) {
      tied = true;
    }
  });
  return tied ? null : best;
}

// 입력 중 카테고리를 자동 선택한다. 사용자가 직접 고른 뒤에는 건드리지 않는다
let categoryChosenByUser = false;

inputEl.addEventListener('input', () => {
  if (categoryChosenByUser) return;
  const guess = classifyText(inputEl.value);
  if (guess) categoryEl.value = guess;
});

// change는 사용자가 직접 바꿀 때만 발생 (코드로 value를 바꾸면 발생하지 않음)
categoryEl.addEventListener('change', () => {
  categoryChosenByUser = true;
});

// ---------- 이벤트 ----------

// 버튼 클릭과 Enter 모두 submit 이벤트로 처리
formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  addTodo();
});

// 이벤트 위임: 목록 하나에만 리스너를 단다
listEl.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.closest('.delete-btn')) deleteTodo(id);
  else if (e.target.closest('.edit-btn')) startEdit(id);
  else if (e.target.closest('.save-btn')) saveEditFrom(li);
  else if (e.target.closest('.cancel-btn')) cancelEdit();
});

listEl.addEventListener('change', (e) => {
  if (!e.target.matches('.todo-check')) return;
  toggleTodo(e.target.closest('li').dataset.id);
});

listEl.addEventListener('dblclick', (e) => {
  const text = e.target.closest('.todo-text');
  if (text) startEdit(text.closest('li').dataset.id);
});

listEl.addEventListener('keydown', (e) => {
  if (e.target.matches('.drag-handle')) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveByStep(e.target.closest('li').dataset.id, e.key === 'ArrowUp' ? -1 : 1);
    }
    return;
  }
  if (!e.target.matches('.edit-text, .edit-category')) return;
  if (e.isComposing) return; // 한글 조합 중 Enter는 무시
  if (e.key === 'Enter') {
    e.preventDefault();
    saveEditFrom(e.target.closest('li'));
  } else if (e.key === 'Escape') {
    cancelEdit();
  }
});

// 드래그 앤 드롭 순서 변경 (같은 완료 상태 그룹 안에서만)
listEl.addEventListener('dragstart', (e) => {
  // 글자를 선택해서 끌면 target이 텍스트 노드일 수 있다
  const el = e.target.nodeType === 1 ? e.target : e.target.parentElement;
  const li = el && el.closest('li');
  if (!li || !li.draggable) return;
  dragId = li.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragId); // Firefox는 데이터가 있어야 드래그가 시작된다
  li.classList.add('dragging');
});

listEl.addEventListener('dragover', (e) => {
  if (!dragId) return;
  const li = e.target.closest('li');
  if (!li || li.dataset.id === dragId || !canReorder(dragId, li.dataset.id)) return;
  e.preventDefault(); // 드롭 허용
  e.dataTransfer.dropEffect = 'move';
  const after = dropAfter(e, li);
  listEl.querySelectorAll('.drop-before, .drop-after').forEach((el) => {
    el.classList.remove('drop-before', 'drop-after');
  });
  li.classList.add(after ? 'drop-after' : 'drop-before');
});

listEl.addEventListener('drop', (e) => {
  if (!dragId) return;
  const li = e.target.closest('li');
  if (!li || li.dataset.id === dragId || !canReorder(dragId, li.dataset.id)) return;
  e.preventDefault();
  const id = dragId;
  dragId = null;
  moveTodo(id, li.dataset.id, dropAfter(e, li));
});

listEl.addEventListener('dragend', () => {
  dragId = null;
  clearDropMarks();
});

clearDoneEl.addEventListener('click', clearCompleted);

// 필터 탭: 화면만 다시 그리고 저장하지 않는다
document.querySelector('.filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  filter = btn.dataset.filter;
  editingId = null;
  render();
});

// 날짜 이동
datePrevEl.addEventListener('click', () => setDate(shiftDate(selectedDate, -1)));
dateNextEl.addEventListener('click', () => {
  if (selectedDate < todayStr()) setDate(shiftDate(selectedDate, 1));
});
dateTodayEl.addEventListener('click', () => setDate(todayStr()));
dateInputEl.addEventListener('change', () => {
  const v = dateInputEl.value;
  if (!isValidDateStr(v)) {
    render(); // 비우거나 잘못 입력하면 원래 날짜로 되돌린다
    return;
  }
  setDate(v > todayStr() ? todayStr() : v);
});
carryOverEl.addEventListener('click', carryOverIncomplete);

// 카테고리 관리
categoryFormEl.addEventListener('submit', (e) => {
  e.preventDefault();
  if (addCategory(categoryNameEl.value, Number(categoryColorEl.value))) {
    categoryNameEl.value = '';
  }
  categoryNameEl.focus();
});

// 관리 목록은 카테고리가 바뀔 때 다시 만들어지므로, 작업 후 같은 줄 버튼으로 포커스를 돌려준다
function focusCategoryButton(id, cls) {
  const li = [...categoryListEl.children].find((el) => el.dataset.id === id);
  const btn = li && li.querySelector('.' + cls);
  (btn || categoryNameEl).focus();
}

categoryListEl.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const id = li.dataset.id;
  if (e.target.closest('.cat-rename')) {
    renameCategory(id);
    focusCategoryButton(id, 'cat-rename');
  } else if (e.target.closest('.cat-delete')) {
    deleteCategory(id);
    focusCategoryButton(id, 'cat-delete');
  }
});

// 백업
exportEl.addEventListener('click', exportData);
importEl.addEventListener('click', () => importFileEl.click());
importFileEl.addEventListener('change', async () => {
  const file = importFileEl.files[0];
  importFileEl.value = ''; // 같은 파일을 다시 선택해도 change가 발생하도록 비운다
  if (file) await importData(file);
});

// 단축키: "/" 를 누르면 어디서든 입력창으로 이동한다 (이미 입력 중이면 그대로 글자로 입력)
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  const el = document.activeElement;
  const typing = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  if (typing && !(el.tagName === 'INPUT' && ['checkbox', 'radio', 'button'].includes(el.type))) return;
  e.preventDefault();
  inputEl.focus();
});

// 테마
themeToggleEl.addEventListener('click', toggleTheme);
// 직접 고른 적이 없으면 OS 테마 변경을 실시간으로 따라간다
darkQuery.addEventListener('change', () => {
  if (!getStoredTheme()) applyTheme(currentTheme());
});

// 색상 선택 상자는 처음에 한 번만 채운다
COLOR_CHOICES.forEach((c) => {
  const opt = document.createElement('option');
  opt.value = String(c.hue);
  opt.textContent = c.label;
  categoryColorEl.appendChild(opt);
});

applyTheme(currentTheme());
render();
