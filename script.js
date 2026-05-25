/* ============================================================
   FOCUS — Task Manager  |  script.js
   
   Features:
   ① Today / Tomorrow / Next Week / Next Month sections
   ② Category filtering: 就活 / インターン / 大学
   ③ Priority levels: High / Medium / Low
   ④ localStorage persistence per month
   ⑤ [Additional] Drag & Drop reordering of tasks
   ============================================================ */

'use strict';

// ──────────────────────────────────────────
// Constants & Config
// ──────────────────────────────────────────

const SECTIONS = {
  today:     { title: 'Today',      subtitle: '今日のタスク' },
  tomorrow:  { title: 'Tomorrow',   subtitle: '明日のタスク' },
  nextWeek:  { title: 'Next Week',  subtitle: '来週のタスクと目標' },
  nextMonth: { title: 'Next Month', subtitle: '来月のタスクと目標' },
};

const CATEGORIES = {
  '就活':    { color: '#f59e0b', borderColor: '#f59e0b30' },
  'インターン': { color: '#10b981', borderColor: '#10b98130' },
  '大学':    { color: '#818cf8', borderColor: '#818cf830' },
};

const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' };

// ──────────────────────────────────────────
// Application State
// ──────────────────────────────────────────

const state = {
  section:  'today',
  category: 'all',
  year:     new Date().getFullYear(),
  month:    new Date().getMonth() + 1, // 1–12
  data:     { today: [], tomorrow: [], nextWeek: [], nextMonth: [] },
};

// ──────────────────────────────────────────
// Storage
// ──────────────────────────────────────────

function storageKey() {
  return `focus_v1_${state.year}_${String(state.month).padStart(2, '0')}`;
}

/** 前月の year / month を返す */
function prevMonthInfo() {
  let y = state.year, m = state.month - 1;
  if (m < 1) { m = 12; y--; }
  return { year: y, month: m };
}

/** 前月の localStorage キー */
function prevMonthStorageKey() {
  const { year, month } = prevMonthInfo();
  return `focus_v1_${year}_${String(month).padStart(2, '0')}`;
}

/** 前月データをロード（なければ null） */
function loadPrevMonthData() {
  try {
    const raw = localStorage.getItem(prevMonthStorageKey());
    if (!raw) return null;
    const p = JSON.parse(raw);
    return {
      today:     p?.today     ?? [],
      tomorrow:  p?.tomorrow  ?? [],
      nextWeek:  p?.nextWeek  ?? [],
      nextMonth: p?.nextMonth ?? [],
    };
  } catch { return null; }
}

/** 前月の全セクションにある未完了タスク総数 */
function countPrevIncomplete(prevData) {
  if (!prevData) return 0;
  return Object.values(prevData).flat().filter(t => !t.completed).length;
}

function loadData() {
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : null;
    state.data = {
      today:     parsed?.today     ?? [],
      tomorrow:  parsed?.tomorrow  ?? [],
      nextWeek:  parsed?.nextWeek  ?? [],
      nextMonth: parsed?.nextMonth ?? [],
    };
  } catch {
    state.data = { today: [], tomorrow: [], nextWeek: [], nextMonth: [] };
  }
}

function saveData() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state.data));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

// ──────────────────────────────────────────
// Task CRUD
// ──────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addTask() {
  const inputEl    = el('task-input');
  const categoryEl = el('task-category');
  const priorityEl = el('task-priority');

  const text = inputEl.value.trim();
  if (!text) {
    inputEl.focus();
    return;
  }

  const task = {
    id:        uid(),
    text,
    category:  categoryEl.value,
    priority:  priorityEl.value,
    completed: false,
    createdAt: Date.now(),
  };

  state.data[state.section].push(task);
  saveData();
  inputEl.value = '';
  inputEl.focus();
  render();
}

function toggleTask(id) {
  const task = state.data[state.section].find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveData();
  render();
}

function deleteTask(id) {
  state.data[state.section] = state.data[state.section].filter(t => t.id !== id);
  saveData();
  render();
}

// ──────────────────────────────────────────
// Carryover — 前月タスク引き継ぎ
// ──────────────────────────────────────────

/**
 * 前月の未完了タスクをすべて当月にコピーする。
 * - 新しい ID を振り直す（重複防止）
 * - completed は false にリセット
 * - 各セクション（today / tomorrow / nextWeek / nextMonth）ごとに引き継ぐ
 */
function carryoverFromPrevMonth() {
  const prevData = loadPrevMonthData();
  if (!prevData) return;

  let carried = 0;

  Object.keys(state.data).forEach(section => {
    const incomplete = (prevData[section] ?? []).filter(t => !t.completed);
    incomplete.forEach(task => {
      state.data[section].push({
        ...task,
        id:        uid(),          // 新 ID
        completed: false,          // 完了フラグをリセット
        createdAt: Date.now(),
      });
      carried++;
    });
  });

  if (carried > 0) {
    saveData();
    render();
  }
}

// ──────────────────────────────────────────
// Filtering & Sorting
// ──────────────────────────────────────────

function getVisibleTasks() {
  const tasks = state.data[state.section] ?? [];
  return state.category === 'all'
    ? tasks
    : tasks.filter(t => t.category === state.category);
}

function splitTasks(tasks) {
  const active    = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);
  return { active, completed };
}

// ──────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────

function el(id) { return document.getElementById(id); }

function render() {
  renderTasks();
  renderHeader();
  renderBadges();
}

function renderHeader() {
  const info = SECTIONS[state.section];
  el('section-title').textContent    = info.title;
  el('section-subtitle').textContent = info.subtitle;

  const visible  = getVisibleTasks();
  const total    = visible.length;
  const done     = visible.filter(t => t.completed).length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

  el('stat-total').textContent   = total;
  el('stat-done').textContent    = done;
  el('progress-fill').style.width = pct + '%';
  el('progress-pct').textContent  = pct + '%';
}

function renderBadges() {
  Object.keys(SECTIONS).forEach(sec => {
    const tasks      = state.data[sec] ?? [];
    const incomplete = tasks.filter(t => !t.completed).length;
    const badge      = el('badge-' + sec);
    if (!badge) return;
    if (incomplete > 0) {
      badge.textContent   = incomplete;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  });
}

function renderTasks() {
  const listEl   = el('task-list');
  const emptyEl  = el('empty-state');
  const hintEl   = el('drag-hint');
  const visible  = getVisibleTasks();
  const { active, completed } = splitTasks(visible);

  if (visible.length === 0) {
    listEl.innerHTML  = '';
    emptyEl.style.display = 'flex';
    hintEl.style.display  = 'none';

    // ── Carryover prompt ──
    // 全セクション合計でも当月データが空の場合のみ表示
    const currentTotal = Object.values(state.data).flat().length;
    const promptEl     = el('carryover-prompt');
    const labelEl      = el('carryover-label');
    const detailEl     = el('carryover-detail');

    if (currentTotal === 0) {
      const prevData = loadPrevMonthData();
      const count    = countPrevIncomplete(prevData);
      if (count > 0) {
        const { year, month } = prevMonthInfo();
        labelEl.textContent  = `${year}年${MONTH_NAMES[month - 1]}に未完了のタスクがあります`;
        detailEl.textContent = `全セクション合計 ${count} 件を引き継ぎます`;
        promptEl.style.display = 'flex';
      } else {
        promptEl.style.display = 'none';
      }
    } else {
      promptEl.style.display = 'none';
    }

    return;
  }

  emptyEl.style.display = 'none';
  hintEl.style.display  = active.length > 1 ? 'flex' : 'none';

  let html = '';
  active.forEach(task => { html += taskHTML(task); });

  if (completed.length > 0) {
    html += `
      <div class="done-divider">
        <div class="done-divider-line"></div>
        <span class="done-divider-label">完了済み（${completed.length}件）</span>
        <div class="done-divider-line"></div>
      </div>`;
    completed.forEach(task => { html += taskHTML(task); });
  }

  listEl.innerHTML = html;
  initDragDrop();
}

function taskHTML(task) {
  const catInfo = CATEGORIES[task.category] ?? { color: '#888', borderColor: '#88882a' };
  const priLabel = PRIORITY_LABELS[task.priority] ?? '中';

  return `
    <div class="task-item ${task.completed ? 'task-item--done' : ''}"
         data-id="${task.id}"
         draggable="${!task.completed}">

      <span class="drag-handle" title="ドラッグして並び替え">⠿</span>

      <button class="task-check ${task.completed ? 'task-check--done' : ''}"
              onclick="toggleTask('${task.id}')"
              title="${task.completed ? '未完了に戻す' : '完了にする'}">
        ${task.completed ? '✓' : ''}
      </button>

      <div class="task-body">
        <span class="task-text">${escapeHTML(task.text)}</span>

        <div class="task-meta-group">
          <span class="task-cat-chip"
                style="color:${catInfo.color}; border-color:${catInfo.borderColor}">
            <span class="task-cat-dot" style="background:${catInfo.color}"></span>
            ${task.category}
          </span>

          <span class="task-pri task-pri--${task.priority}">${priLabel}</span>
        </div>
      </div>

      <button class="task-del"
              onclick="deleteTask('${task.id}')"
              title="削除">×</button>
    </div>`;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────
// ⑤ Additional Feature: Drag & Drop Reorder
// ──────────────────────────────────────────
// Allows users to reorder active (uncompleted) tasks via
// native HTML5 Drag & Drop. The order is persisted to
// localStorage immediately after each drop.
// ──────────────────────────────────────────

let dragSrcId = null;

function initDragDrop() {
  const items = document.querySelectorAll('.task-item:not(.task-item--done)');

  items.forEach(item => {
    item.addEventListener('dragstart',  onDragStart,  false);
    item.addEventListener('dragover',   onDragOver,   false);
    item.addEventListener('dragleave',  onDragLeave,  false);
    item.addEventListener('drop',       onDrop,       false);
    item.addEventListener('dragend',    onDragEnd,    false);
  });
}

function onDragStart(e) {
  dragSrcId = this.dataset.id;
  this.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcId);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.task-item').forEach(el => {
    el.classList.remove('is-drag-over');
  });
  this.classList.add('is-drag-over');
}

function onDragLeave() {
  this.classList.remove('is-drag-over');
}

function onDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  this.classList.remove('is-drag-over');

  const dropId = this.dataset.id;
  if (!dragSrcId || dragSrcId === dropId) return;

  const tasks    = state.data[state.section];
  const srcIdx   = tasks.findIndex(t => t.id === dragSrcId);
  const dropIdx  = tasks.findIndex(t => t.id === dropId);
  if (srcIdx === -1 || dropIdx === -1) return;

  // Remove source task and re-insert before target
  const [moved] = tasks.splice(srcIdx, 1);
  const newDst  = tasks.findIndex(t => t.id === dropId);
  tasks.splice(newDst, 0, moved);

  saveData();

  // Re-render without animation to avoid flicker
  const listEl = el('task-list');
  listEl.querySelectorAll('.task-item').forEach(el => el.classList.add('no-anim'));
  render();
}

function onDragEnd() {
  dragSrcId = null;
  document.querySelectorAll('.task-item').forEach(el => {
    el.classList.remove('is-dragging', 'is-drag-over');
  });
}

// ──────────────────────────────────────────
// Section & Category Switching
// ──────────────────────────────────────────

function setSection(section) {
  state.section = section;

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  render();
}

function setCategory(category) {
  state.category = category;

  document.querySelectorAll('.cat-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  render();
}

// ──────────────────────────────────────────
// Month Navigation
// ──────────────────────────────────────────

const MONTH_NAMES = [
  '1月','2月','3月','4月','5月','6月',
  '7月','8月','9月','10月','11月','12月'
];

function updateMonthDisplay() {
  el('month-display').textContent =
    `${state.year}年${MONTH_NAMES[state.month - 1]}`;
}

function changeMonth(delta) {
  state.month += delta;
  if (state.month < 1)  { state.month = 12; state.year--; }
  if (state.month > 12) { state.month = 1;  state.year++; }
  loadData();
  updateMonthDisplay();
  render();
}

// ──────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Load persisted data
  loadData();
  updateMonthDisplay();

  // Section navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => setSection(btn.dataset.section));
  });

  // Category filter
  document.querySelectorAll('.cat-item').forEach(btn => {
    btn.addEventListener('click', () => setCategory(btn.dataset.category));
  });

  // Add task
  el('add-btn').addEventListener('click', addTask);
  el('task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) addTask();
  });

  // Month navigation
  el('prev-month').addEventListener('click', () => changeMonth(-1));
  el('next-month').addEventListener('click', () => changeMonth(+1));

  // Carryover button
  el('carryover-btn').addEventListener('click', carryoverFromPrevMonth);

  // Initial render
  render();
});

// ──────────────────────────────────────────
// Expose globals for inline onclick handlers
// ──────────────────────────────────────────
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
