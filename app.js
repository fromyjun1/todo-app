const STORAGE_KEY = 'todos';
const MAX_LENGTH = 100;
const CATEGORY_LABELS = { work: '업무', personal: '개인', study: '공부' };

const todayEl = document.getElementById('today');
const formEl = document.getElementById('todo-form');
const inputEl = document.getElementById('todo-input');
const categoryEl = document.getElementById('todo-category');
const listEl = document.getElementById('todo-list');
const emptyEl = document.getElementById('empty-message');
const clearDoneEl = document.getElementById('clear-done');
const progressTextEl = document.getElementById('progress-text');
const progressBarEl = document.getElementById('progress-bar');
const progressFillEl = document.getElementById('progress-fill');
const filterEls = document.querySelectorAll('.filter');
const categoryProgressEls = {
  work: document.querySelector('#progress-categories .cat-work'),
  personal: document.querySelector('#progress-categories .cat-personal'),
  study: document.querySelector('#progress-categories .cat-study'),
};

// 상태: todos 배열 하나
let todos = loadTodos();
// UI 상태: 수정 중인 항목 id (저장 대상 아님)
let editingId = null;
// UI 상태: 현재 필터 ('all' | 카테고리). 화면 표시에만 쓰고 저장하지 않는다
let filter = 'all';

// 오늘 날짜 표시
const today = new Date();
const pad = (n) => String(n).padStart(2, '0');
todayEl.dateTime = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
todayEl.textContent = today.toLocaleDateString('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

function isValidTodo(t) {
  return (
    t &&
    typeof t.id === 'string' &&
    typeof t.text === 'string' &&
    t.text.length >= 1 &&
    t.text.length <= MAX_LENGTH &&
    Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, t.category) &&
    typeof t.completed === 'boolean' &&
    typeof t.createdAt === 'number'
  );
}

function loadTodos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed.filter(isValidTodo) : [];
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

// 미완료 먼저, 완료 나중. 같은 그룹 안에서는 입력 순서 유지 (상태 배열 자체는 바꾸지 않음)
function sortedTodos() {
  return [...todos.filter((t) => !t.completed), ...todos.filter((t) => t.completed)];
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

function renderViewItem(li, todo) {
  const text = document.createElement('span');
  text.className = 'todo-text';
  text.textContent = todo.text;

  const badge = document.createElement('span');
  badge.className = 'badge ' + todo.category;
  badge.textContent = CATEGORY_LABELS[todo.category];

  li.append(
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
  Object.entries(CATEGORY_LABELS).forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
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

// 진행률은 필터와 무관하게 항상 전체 todos 기준
function renderProgress() {
  const total = todos.length;
  const done = todos.filter((t) => t.completed).length;
  const pct = percent(done, total);

  progressTextEl.textContent = `${done}/${total} 완료 (${pct}%)`;
  progressFillEl.style.width = pct + '%';
  progressBarEl.setAttribute('aria-valuenow', String(pct));
  progressBarEl.setAttribute('aria-valuetext', `${done}/${total} 완료 (${pct}%)`);

  Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
    const inCat = todos.filter((t) => t.category === key);
    const catDone = inCat.filter((t) => t.completed).length;
    categoryProgressEls[key].textContent =
      `${label} ${catDone}/${inCat.length} (${percent(catDone, inCat.length)}%)`;
  });
}

function renderFilters() {
  filterEls.forEach((btn) => {
    const active = btn.dataset.filter === filter;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

// 다시 그리기 전에 목록 안의 포커스 위치(항목 id + 컨트롤 종류)를 기억한다
function captureFocus() {
  const active = document.activeElement;
  if (!listEl.contains(active)) return null;
  const li = active.closest('li');
  return { id: li.dataset.id, cls: active.classList[0] };
}

// 키보드 사용자가 위치를 잃지 않도록 포커스를 복원한다
function restoreFocus(saved) {
  const li = [...listEl.children].find((el) => el.dataset.id === saved.id);
  const target = li && (li.querySelector('.' + saved.cls) || li.querySelector('.edit-btn'));
  (target || inputEl).focus(); // 항목이 사라졌다면(삭제) 입력창으로
}

// 전체 화면을 상태에서 다시 그린다
function render() {
  const savedFocus = captureFocus();
  listEl.replaceChildren();
  let editInput = null;

  const visible = sortedTodos().filter((t) => filter === 'all' || t.category === filter);
  visible.forEach((todo) => {
    const li = document.createElement('li');
    li.dataset.id = todo.id;
    if (todo.completed) li.classList.add('done');

    if (todo.id === editingId) {
      li.classList.add('editing');
      renderEditItem(li, todo);
      editInput = li.querySelector('.edit-text');
    } else {
      renderViewItem(li, todo);
    }
    listEl.appendChild(li);
  });

  emptyEl.hidden = todos.length > 0;
  renderProgress();
  renderFilters();
  clearDoneEl.disabled = !todos.some((t) => t.completed);

  if (editInput) {
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  } else if (savedFocus) {
    restoreFocus(savedFocus);
  }
}

function addTodo() {
  const text = inputEl.value.trim().slice(0, MAX_LENGTH);
  if (!text) return;

  // 다른 카테고리 필터가 켜져 있으면 새 항목이 보이도록 해당 탭으로 이동
  if (filter !== 'all') filter = categoryEl.value;

  const now = Date.now();
  todos.push({
    id: now.toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    category: categoryEl.value,
    completed: false,
    createdAt: now,
  });
  saveTodos();
  render();

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

function clearCompleted() {
  if (!todos.some((t) => t.completed)) return;
  if (!confirm('완료된 항목을 모두 삭제할까요?')) return;
  todos = todos.filter((t) => !t.completed);
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
  if (!e.target.matches('.edit-text, .edit-category')) return;
  if (e.isComposing) return; // 한글 조합 중 Enter는 무시
  if (e.key === 'Enter') {
    e.preventDefault();
    saveEditFrom(e.target.closest('li'));
  } else if (e.key === 'Escape') {
    cancelEdit();
  }
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

render();
