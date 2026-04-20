// Клиентская логика админ-панели.
//
// Что делает страница /admin:
//   1. При загрузке проверяет, есть ли сохранённый JWT → если есть и валиден, пускает сразу в панель.
//   2. Если токена нет (или 401) — показывает форму входа.
//   3. GET /auth/check решает, показывать ли кнопку «Зарегистрироваться» (только если админов ещё ноль).
//   4. POST /auth/login делает form-urlencoded запрос (так требует OAuth2 Password Flow на бэке).
//   5. Успешный логин → токен в localStorage + переход в panel-view.
//   6. Logout чистит токен и возвращает на форму входа.
//
// Содержимое панели (таблица услуг, статистика, заявки) добавится на следующих шагах VPh06.

import './admin.css';

const API_BASE = '/api';
// Ключ в localStorage. Инкапсулирован в константы getToken/setToken/clearToken —
// если позже захотим вынести в cookie, придётся менять только там.
const TOKEN_KEY = 'autello_admin_token';

const $ = (id) => document.getElementById(id);

// --- Элементы DOM -----------------------------------------------------------

const loadingView = $('loading-view');
const authView = $('auth-view');
const panelView = $('panel-view');

const authForm = $('auth-form');
const authTitle = $('auth-title');
const authHint = $('auth-hint');
const authSubmit = $('auth-submit');
const authStatus = $('auth-status');
const toggleRegisterBtn = $('toggle-register');

const headerUser = $('header-user');
const headerUsername = $('header-username');
const panelUsername = $('panel-username');
const logoutBtn = $('logout-btn');

// --- Состояние --------------------------------------------------------------

// Режим формы: 'login' — вход, 'register' — первая регистрация.
// Переключается только если админов в системе ещё нет.
let authMode = 'login';

// --- Хранилище токена -------------------------------------------------------

const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// --- Вспомогательное -------------------------------------------------------

function showView(view) {
  // Ровно одна секция видима в любой момент. Убираем флаг у всех и вешаем
  // на нужную — так проще, чем следить за комбинациями display вручную.
  for (const v of [loadingView, authView, panelView]) v.classList.remove('is-active');
  view.classList.add('is-active');
}

function setStatus(message, type = '') {
  authStatus.className = 'form__status' + (type ? ` ${type}` : '');
  authStatus.textContent = message;
}

// Обёртка над fetch: автоматически подставляет Bearer-токен и, если 401,
// чистит протухший токен — чтобы следующий вход-логин прошёл корректно.
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
  }
  return response;
}

// --- Проверка, есть ли уже админы -----------------------------------------

async function refreshRegisterAvailability() {
  // Регистрация видна только пока админов ноль. После появления первого —
  // кнопка скрывается и в DOM, и переключиться туда через authMode нельзя.
  try {
    const response = await fetch(`${API_BASE}/auth/check`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { has_admins } = await response.json();
    toggleRegisterBtn.hidden = has_admins;
    // Если форма сейчас в режиме регистрации, но админы уже появились —
    // возвращаем её в login.
    if (has_admins && authMode === 'register') setAuthMode('login');
  } catch (err) {
    console.error('auth/check failed:', err);
    // В случае ошибки API — безопаснее скрыть регистрацию, чем внезапно показать.
    toggleRegisterBtn.hidden = true;
  }
}

// --- Переключение login / register -----------------------------------------

function setAuthMode(mode) {
  authMode = mode;
  if (mode === 'register') {
    authTitle.textContent = 'Регистрация первого админа';
    authHint.textContent = 'Эта форма доступна, только пока в системе нет ни одного администратора.';
    authSubmit.textContent = 'Создать админа';
    toggleRegisterBtn.textContent = 'Уже есть аккаунт — войти';
  } else {
    authTitle.textContent = 'Вход';
    authHint.textContent = 'Введите логин и пароль администратора.';
    authSubmit.textContent = 'Войти';
    toggleRegisterBtn.textContent = 'Зарегистрироваться';
  }
  setStatus('');
}

toggleRegisterBtn.addEventListener('click', () => {
  setAuthMode(authMode === 'login' ? 'register' : 'login');
});

// --- Сабмит формы ----------------------------------------------------------

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!authForm.reportValidity()) return;

  const formData = new FormData(authForm);
  const username = formData.get('username').trim();
  const password = formData.get('password');

  authSubmit.disabled = true;
  setStatus(authMode === 'login' ? 'Входим…' : 'Регистрируем…');

  try {
    if (authMode === 'register') {
      // JSON — так ждёт /auth/register.
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const detail = await safeDetail(response);
        throw new Error(detail || `Ошибка регистрации (HTTP ${response.status})`);
      }
      setStatus('Админ создан, выполняем вход…', 'success');
      // После регистрации сразу логинимся тем же паролем.
    }

    // Логин: OAuth2 Password Flow — application/x-www-form-urlencoded.
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);

    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      body,
    });
    if (!loginResponse.ok) {
      const detail = await safeDetail(loginResponse);
      throw new Error(detail || 'Неверный логин или пароль');
    }
    const { access_token } = await loginResponse.json();
    setToken(access_token);

    await enterPanel();
  } catch (err) {
    console.error('Auth failed:', err);
    setStatus(err.message || 'Не удалось войти', 'error');
  } finally {
    authSubmit.disabled = false;
  }
});

// --- Выход -----------------------------------------------------------------

logoutBtn.addEventListener('click', () => {
  clearToken();
  headerUser.hidden = true;
  setAuthMode('login');
  authForm.reset();
  setStatus('');
  showView(authView);
});

// --- Вход в панель после успешного логина / при валидном токене -----------

async function enterPanel() {
  // После успешной авторизации дёргаем /auth/me чтобы:
  //  1) убедиться, что токен реально принят бэкендом,
  //  2) вывести username в шапку.
  try {
    const response = await apiFetch('/auth/me');
    if (!response.ok) throw new Error('Токен недействителен');
    const admin = await response.json();

    headerUsername.textContent = admin.username;
    panelUsername.textContent = admin.username;
    headerUser.hidden = false;

    showView(panelView);

    // После входа подгружаем данные для блоков панели параллельно.
    await Promise.all([loadServices(), loadApplications()]);
  } catch (err) {
    console.error('Enter panel failed:', err);
    clearToken();
    await refreshRegisterAvailability();
    showView(authView);
    setStatus('Сессия истекла, войдите заново', 'error');
  }
}

// --- CRUD услуг ------------------------------------------------------------
// Архитектура: локальный массив `services` зеркалит состояние бэкенда. Любая
// мутация (POST/PUT/DELETE) заканчивается перезагрузкой списка — так мы
// гарантированно видим актуальное состояние и не сочиняем id/метки времени
// на фронте. Для учебного проекта это проще и надёжнее optimistic UI.

const tbody = $('services-tbody');
const servicesStatus = $('services-status');
const servicesAddBtn = $('services-add-btn');

let services = [];

// id строки, которая сейчас в режиме редактирования.
// null — никто не редактируется; 'new' — мы добавляем новую услугу.
let editingId = null;

function setServicesStatus(message, type = '') {
  servicesStatus.className = 'form__status' + (type ? ` ${type}` : '');
  servicesStatus.textContent = message;
}

async function loadServices() {
  setServicesStatus('Загружаем услуги…');
  try {
    // GET /admin-settings публичный — токен не нужен, но apiFetch всё равно подставит
    // (бэку не мешает). Главное — централизованная обработка 401.
    const response = await apiFetch('/admin-settings');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    services = await response.json();
    setServicesStatus('');
    editingId = null;
    renderServices();
  } catch (err) {
    console.error('loadServices failed:', err);
    setServicesStatus('Не удалось загрузить список услуг', 'error');
  }
}

function renderServices() {
  // Полная перерисовка tbody — проще, чем сверять diff. Список услуг небольшой,
  // перформанс не проблема. При необходимости заменим на точечное обновление.
  tbody.innerHTML = '';

  // Если идёт создание новой — сверху появляется «черновая» строка редактирования.
  if (editingId === 'new') {
    tbody.appendChild(buildEditRow({ id: '', services: '', budget_range: '' }, /* isNew */ true));
  }

  if (services.length === 0 && editingId !== 'new') {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="4" class="cell-empty">Пока ни одной услуги. Нажмите «Добавить услугу».</td>';
    tbody.appendChild(emptyRow);
    return;
  }

  for (const item of services) {
    tbody.appendChild(
      editingId === item.id ? buildEditRow(item, false) : buildViewRow(item)
    );
  }
}

function buildViewRow(item) {
  const tr = document.createElement('tr');
  tr.dataset.id = item.id;
  // textContent, не innerHTML — защита от XSS через содержимое БД.
  const td = (text) => {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
  };
  tr.appendChild(td(item.id));
  tr.appendChild(td(item.services));
  tr.appendChild(td(item.budget_range));

  const actions = document.createElement('td');
  actions.className = 'row-actions';
  actions.appendChild(makeBtn('Изменить', 'btn btn--small btn--ghost', () => beginEdit(item.id)));
  actions.appendChild(makeBtn('Удалить', 'btn btn--small btn--danger', () => deleteService(item)));
  tr.appendChild(actions);
  return tr;
}

function buildEditRow(item, isNew) {
  const tr = document.createElement('tr');
  tr.dataset.id = isNew ? 'new' : item.id;

  const idCell = document.createElement('td');
  idCell.textContent = isNew ? '—' : item.id;
  tr.appendChild(idCell);

  const servicesInput = makeInput('services-input', 'Например: Керамика 9H', item.services);
  const budgetInput = makeInput('budget-input', 'Например: 80k-200k', item.budget_range);
  tr.appendChild(wrapInTd(servicesInput));
  tr.appendChild(wrapInTd(budgetInput));

  const actions = document.createElement('td');
  actions.className = 'row-actions';
  const onSave = () => saveEdit(isNew ? null : item.id, servicesInput.value, budgetInput.value);
  actions.appendChild(makeBtn('Сохранить', 'btn btn--small', onSave));
  actions.appendChild(makeBtn('Отмена', 'btn btn--small btn--ghost', cancelEdit));
  tr.appendChild(actions);

  // Удобство: Enter в любом поле — сохранить, Esc — отмена.
  for (const input of [servicesInput, budgetInput]) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onSave(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    });
  }
  // Автофокус в первое поле — сразу можно печатать.
  setTimeout(() => servicesInput.focus(), 0);
  return tr;
}

function wrapInTd(child) {
  const td = document.createElement('td');
  td.appendChild(child);
  return td;
}

function makeInput(className, placeholder, value) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = `cell-input ${className}`;
  input.placeholder = placeholder;
  input.value = value ?? '';
  return input;
}

function makeBtn(text, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

// --- CRUD-операции ----------------------------------------------------------

function beginEdit(id) {
  editingId = id;
  renderServices();
}

function cancelEdit() {
  editingId = null;
  setServicesStatus('');
  renderServices();
}

async function saveEdit(id, servicesValue, budgetValue) {
  const trimmedServices = servicesValue.trim();
  const trimmedBudget = budgetValue.trim();
  if (!trimmedServices || !trimmedBudget) {
    setServicesStatus('Поля не могут быть пустыми', 'error');
    return;
  }

  const payload = { services: trimmedServices, budget_range: trimmedBudget };
  const isNew = id === null;

  setServicesStatus(isNew ? 'Создаём…' : 'Сохраняем…');
  try {
    const response = await apiFetch(
      isNew ? '/admin-settings' : `/admin-settings/${id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const detail = await safeDetail(response);
      throw new Error(detail || `HTTP ${response.status}`);
    }
    setServicesStatus(isNew ? 'Услуга добавлена' : 'Изменения сохранены', 'success');
    await loadServices();
  } catch (err) {
    console.error('saveEdit failed:', err);
    setServicesStatus('Не удалось сохранить: ' + err.message, 'error');
  }
}

async function deleteService(item) {
  // confirm — минимальная защита от случайного удаления. В проде сделаем
  // красивую модалку, но для учебного достаточно браузерного диалога.
  if (!window.confirm(`Удалить услугу «${item.services}»?`)) return;

  setServicesStatus('Удаляем…');
  try {
    const response = await apiFetch(`/admin-settings/${item.id}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) {
      const detail = await safeDetail(response);
      throw new Error(detail || `HTTP ${response.status}`);
    }
    setServicesStatus('Удалено', 'success');
    await loadServices();
  } catch (err) {
    console.error('deleteService failed:', err);
    setServicesStatus('Не удалось удалить: ' + err.message, 'error');
  }
}

servicesAddBtn.addEventListener('click', () => {
  // Защита от двойного клика: если уже в режиме добавления — ничего не делаем.
  if (editingId === 'new') return;
  beginEdit('new');
});

// --- Статистика пользователей (модалка) -----------------------------------
// Загружаем последние N метрик, агрегируем на фронте:
//  * среднее время на странице за день/неделю/месяц — берём МАКС time_on_page
//    на каждую «сессию» (сессия = 1 минута группировки по created_at);
//  * heatmap — объединяем все cursor_positions, рисуем кружки в SVG 1920×1080.

const statsOpenBtn = $('stats-open-btn');
const statsModal = $('stats-modal');
const statsStatus = $('stats-status');
const statDay = $('stat-day');
const statWeek = $('stat-week');
const statMonth = $('stat-month');
const heatmapSvg = $('heatmap-svg');
const heatmapHint = $('heatmap-hint');

function setStatsStatus(message, type = '') {
  statsStatus.className = 'form__status' + (type ? ` ${type}` : '');
  statsStatus.textContent = message;
}

function openStatsModal() {
  statsModal.hidden = false;
  statsModal.setAttribute('aria-hidden', 'false');
  // Вешаем ESC-закрытие только пока модалка открыта.
  document.addEventListener('keydown', escCloseModal);
  loadStats();
}

function closeStatsModal() {
  statsModal.hidden = true;
  statsModal.setAttribute('aria-hidden', 'true');
  document.removeEventListener('keydown', escCloseModal);
}

function escCloseModal(e) { if (e.key === 'Escape') closeStatsModal(); }

statsOpenBtn.addEventListener('click', openStatsModal);

// Делегируем закрытие: любой элемент с data-close-modal внутри модалки закрывает её.
statsModal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-modal]')) closeStatsModal();
});

// --- Заявки: загрузка, скоринг, рендер, просмотр -------------------------
// Алгоритм «температуры» лида — простой rule-based скоринг:
//   budget, deadline, company_size, role, business_niche, task_scope.
// Считаем на фронте, чтобы видеть логику в одном месте и легко менять.
// Для больших объёмов перенесли бы в SQL; 100 заявок в таблице — не проблема.

const applicationsTbody = $('applications-tbody');
const applicationsStatus = $('applications-status');
const applicationsSummary = $('applications-summary');
const appModal = $('app-modal');
const appModalBody = $('app-modal-body');
const appModalTitle = $('app-modal-title');

function setApplicationsStatus(message, type = '') {
  applicationsStatus.className = 'form__status' + (type ? ` ${type}` : '');
  applicationsStatus.textContent = message;
}

// Скоринг — баллы за сигналы, reasons для объяснения в модалке.
function scoreApplication(app) {
  let score = 0;
  const reasons = [];

  const budget = (app.budget || '').toLowerCase();
  // 2m+, 1.5m, 1m — очень крупный бюджет
  if (/\b[2-9](m|\s*m|млн)|\b1[0-9]+m|\b\d+\s*m\+/.test(budget) ||
      /[2-9]\d{2}\s*k\+|^[1-9]m/.test(budget)) {
    score += 4;
    reasons.push('Крупный бюджет (>1M ₽)');
  } else if (/\b1m|\b[4-9]\d{2}\s*k|\b1\.\d+m/.test(budget)) {
    score += 3;
    reasons.push('Высокий бюджет (400K–1M ₽)');
  } else if (/\b[1-3]\d{2}\s*k/.test(budget)) {
    score += 2;
    reasons.push('Средний бюджет (100–300K ₽)');
  } else if (/\b\d+k/.test(budget)) {
    score += 1;
    reasons.push('Небольшой бюджет');
  }

  const deadline = (app.deadline || '').toLowerCase();
  if (/сроч|asap|today|сегодня|завтра|\b[1-3]\s*дн|горящ/.test(deadline)) {
    score += 3;
    reasons.push('Горящий срок (дни)');
  } else if (/\b1\s*нед|неделя/.test(deadline)) {
    score += 2;
    reasons.push('Срок — неделя');
  } else if (/\b2\s*нед|\b3\s*нед|две нед|три нед/.test(deadline)) {
    score += 1;
    reasons.push('Срок — 2–3 недели');
  } else if (/\bмесяц|month/.test(deadline)) {
    reasons.push('Срок — месяц');
  } else if (/не срочно|когда-нибудь|пару меся|размыт/.test(deadline)) {
    score -= 1;
    reasons.push('Срок размыт / не спешит');
  }

  const size = (app.company_size || '').toLowerCase();
  if (/\b[1-9]\d{2}\s*\+|\b500|\b1000|enterprise|vip/.test(size)) {
    score += 2;
    reasons.push('Крупная компания');
  } else if (/\b[5-9]\d\s|\b1\d{2}\s/.test(size)) {
    score += 1;
    reasons.push('Средняя компания');
  }

  const role = (app.role || '').toLowerCase();
  if (/руководи|директор|ceo|собствен|владел/.test(role)) {
    score += 2;
    reasons.push('Лицо принимающее решение');
  }

  const niche = (app.business_niche || '').toLowerCase();
  if (/премиум|элит|коллекц|luxury|vip|автосалон/.test(niche)) {
    score += 1;
    reasons.push('Премиум-ниша');
  }

  const scope = (app.task_scope || '').toLowerCase();
  if (/\bпарк|\bфлот|fleet|[5-9]\s*маш|\d{2,}\s*маш/.test(scope)) {
    score += 2;
    reasons.push('Опт — парк/флот машин');
  }

  return { score, reasons };
}

function classifyTemperature(score) {
  // Пороги подобраны под seed_applications.sql: горячие получают 8+, холодные 0–2.
  if (score >= 7) return { label: 'Горячий', code: 'hot', routing: 'Персональный менеджер, топ-команда' };
  if (score >= 3) return { label: 'Тёплый', code: 'warm', routing: 'Обычный менеджер, в работу сегодня' };
  return { label: 'Холодный', code: 'cold', routing: 'Автоответ + рассылка, без приоритета' };
}

async function loadApplications() {
  setApplicationsStatus('Загружаем заявки…');
  try {
    const response = await apiFetch('/applications?skip=0&limit=100');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    setApplicationsStatus('');

    // Скорим и сортируем — горячие наверх.
    const scored = rows.map((row) => {
      const { score, reasons } = scoreApplication(row);
      return { row, score, reasons, temp: classifyTemperature(score) };
    });
    scored.sort((a, b) => b.score - a.score);

    renderApplications(scored);
  } catch (err) {
    console.error('loadApplications failed:', err);
    setApplicationsStatus('Не удалось загрузить заявки: ' + err.message, 'error');
    applicationsTbody.innerHTML = '';
    applicationsSummary.innerHTML = '';
  }
}

function renderApplications(scored) {
  applicationsTbody.innerHTML = '';
  applicationsSummary.innerHTML = '';

  if (scored.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="6" class="cell-empty">Пока нет заявок.</td>';
    applicationsTbody.appendChild(tr);
    return;
  }

  // Сводка сверху: сколько горячих / тёплых / холодных.
  const counts = { hot: 0, warm: 0, cold: 0 };
  for (const s of scored) counts[s.temp.code]++;
  applicationsSummary.innerHTML = `
    <span class="applications-summary__item"><span class="temp-badge hot">Горячие</span> ${counts.hot}</span>
    <span class="applications-summary__item"><span class="temp-badge warm">Тёплые</span> ${counts.warm}</span>
    <span class="applications-summary__item"><span class="temp-badge cold">Холодные</span> ${counts.cold}</span>
  `;

  for (const s of scored) applicationsTbody.appendChild(buildApplicationRow(s));
}

function buildApplicationRow(item) {
  const { row, temp } = item;
  const tr = document.createElement('tr');

  const tempCell = document.createElement('td');
  tempCell.innerHTML = `<span class="temp-badge ${temp.code}">${temp.label}</span>`;
  tr.appendChild(tempCell);

  tr.appendChild(td(fullName(row)));
  tr.appendChild(td(row.service || '—'));
  tr.appendChild(td(row.budget || '—'));
  tr.appendChild(td(row.deadline || '—'));

  const actions = document.createElement('td');
  actions.className = 'row-actions';
  actions.appendChild(makeBtn('Просмотр', 'btn btn--small btn--ghost', () => openAppModal(item)));
  tr.appendChild(actions);

  return tr;
}

function td(text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

function fullName(row) {
  return [row.last_name, row.first_name, row.middle_name].filter(Boolean).join(' ');
}

// --- Модалка деталей заявки ------------------------------------------------

function openAppModal(item) {
  const { row, score, reasons, temp } = item;
  appModalTitle.textContent = `Заявка №${row.id}`;

  const fields = [
    ['ФИО', fullName(row)],
    ['Услуга', row.service],
    ['Бюджет', row.budget],
    ['Срок', row.deadline],
    ['Ниша бизнеса', row.business_niche],
    ['Размер компании', row.company_size],
    ['Роль', row.role],
    ['Объём задачи', row.task_scope],
    ['Удобный контакт', row.preferred_contact],
    ['Удобное время', row.contact_time],
    ['Создана', new Date(row.created_at).toLocaleString('ru-RU')],
  ];

  const grid = fields.map(([label, value]) => {
    const empty = value === null || value === undefined || value === '';
    return `
      <div class="app-details__field">
        <span class="app-details__label">${label}</span>
        <span class="app-details__value ${empty ? 'app-details__value--empty' : ''}">${empty ? '—' : escapeHtml(value)}</span>
      </div>
    `;
  }).join('');

  const reasonsBlock = reasons.length
    ? `<div class="app-details__reasons"><strong>Почему такой балл:</strong>
        <ul>${reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>`
    : '';

  const commentBlock = row.comment
    ? `<div class="app-details__field" style="margin-top:16px;">
        <span class="app-details__label">Комментарий</span>
        <span class="app-details__value">${escapeHtml(row.comment)}</span>
      </div>`
    : '';

  appModalBody.innerHTML = `
    <div class="app-details__head">
      <span class="temp-badge ${temp.code}">${temp.label}</span>
      <span class="app-details__score">Скоринг: ${score}</span>
    </div>
    <div class="app-details__grid">${grid}</div>
    ${commentBlock}
    ${reasonsBlock}
    <div class="app-details__routing"><strong>Рекомендация:</strong> ${escapeHtml(temp.routing)}</div>
  `;

  appModal.hidden = false;
  appModal.setAttribute('aria-hidden', 'false');
  document.addEventListener('keydown', escCloseAppModal);
}

function closeAppModal() {
  appModal.hidden = true;
  appModal.setAttribute('aria-hidden', 'true');
  document.removeEventListener('keydown', escCloseAppModal);
}

function escCloseAppModal(e) { if (e.key === 'Escape') closeAppModal(); }

appModal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-modal]')) closeAppModal();
});

// innerHTML мы используем для вёрстки детали — чтобы PII-значения не
// прошли как HTML, всё пользовательское прогоняем через escape.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Подгружаем заявки при входе в панель — вызовется из enterPanel.
// Объявляем здесь, чтобы enterPanel мог вызвать loadApplications() параллельно со loadServices.

// --- /заявки -----------------------------------------------------------

async function loadStats() {
  setStatsStatus('Загружаем метрики…');
  try {
    // Берём много — агрегация небольшая, пусть клиент считает. Если станет
    // тяжело — перенесём в SQL на бэкенд.
    const response = await apiFetch('/behavior-metrics?skip=0&limit=5000');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    setStatsStatus('');

    renderAverageTimes(rows);
    renderHeatmap(rows);
  } catch (err) {
    console.error('loadStats failed:', err);
    setStatsStatus('Не удалось загрузить статистику: ' + err.message, 'error');
  }
}

// --- Агрегация средних ------------------------------------------------------

function renderAverageTimes(rows) {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const windows = {
    day: { cutoff: now - DAY, el: statDay },
    week: { cutoff: now - 7 * DAY, el: statWeek },
    month: { cutoff: now - 30 * DAY, el: statMonth },
  };

  for (const [, w] of Object.entries(windows)) {
    const filtered = rows.filter((r) => new Date(r.created_at).getTime() >= w.cutoff);
    // Группируем по «сессии» — строки, идущие подряд с интервалом < 5 секунд.
    // Внутри сессии time_on_page монотонно растёт; берём максимум — это и есть
    // «сколько юзер провёл на странице в эту сессию».
    const sessions = groupIntoSessions(filtered);
    if (sessions.length === 0) {
      w.el.textContent = '—';
      continue;
    }
    const avgSeconds = sessions.reduce((sum, s) => sum + s.maxTime, 0) / sessions.length;
    w.el.textContent = formatDuration(avgSeconds);
  }
}

function groupIntoSessions(rows) {
  // rows приходят отсортированными по id DESC. Перевернём в хронологию
  // и по разрывам > 5 сек в created_at разделим на сессии.
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  const sessions = [];
  let current = null;
  for (const row of sorted) {
    const t = new Date(row.created_at).getTime();
    if (!current || t - current.lastT > 5000) {
      current = { maxTime: row.time_on_page || 0, lastT: t };
      sessions.push(current);
    } else {
      if (row.time_on_page > current.maxTime) current.maxTime = row.time_on_page;
      current.lastT = t;
    }
  }
  return sessions;
}

function formatDuration(seconds) {
  const total = Math.round(seconds);
  if (total < 60) return `${total} сек`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins} мин ${secs} сек`;
}

// --- Heatmap -------------------------------------------------------------

function renderHeatmap(rows) {
  // Собираем все точки из cursor_positions (JSON-массивы вида [[x,y], ...]).
  const points = [];
  for (const row of rows) {
    if (!row.cursor_positions) continue;
    try {
      const parsed = JSON.parse(row.cursor_positions);
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          if (Array.isArray(p) && p.length >= 2) points.push([p[0], p[1]]);
        }
      }
    } catch (_) { /* битый JSON — пропускаем */ }
  }

  heatmapHint.textContent = `Всего точек: ${points.length}`;

  // SVG viewBox = 1920×1080 (см. admin.html). Рисуем кружочки прямо в этих
  // координатах — viewport пользователя обычно меньше/другой, но для heatmap
  // нам важны относительные «горячие зоны», не пиксельная точность.
  heatmapSvg.innerHTML = '';
  for (const [x, y] of points) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 20);
    circle.setAttribute('class', 'heatmap__dot');
    heatmapSvg.appendChild(circle);
  }
}

// --- Аккуратное извлечение сообщения об ошибке из ответа FastAPI ----------

async function safeDetail(response) {
  // FastAPI кладёт детали в { detail: "..." } или { detail: [{ msg: "..." }, ...] }.
  try {
    const data = await response.json();
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map((e) => e.msg).join('; ');
  } catch (_) { /* не JSON — ничего не извлекаем */ }
  return '';
}

// --- Точка входа -----------------------------------------------------------

async function init() {
  // Сценарий загрузки:
  //   1. Есть токен? → /auth/me; 200 — в панель, 401 — чистим и показываем логин.
  //   2. Токена нет → логин; параллельно спрашиваем /auth/check чтобы показать/скрыть «регистрацию».
  showView(loadingView);

  if (getToken()) {
    await enterPanel();
    // enterPanel сам переключит view на panel или auth — выходим.
    // Но всё равно обновляем видимость регистрации — вдруг админа удалили вручную.
    await refreshRegisterAvailability();
    return;
  }

  await refreshRegisterAvailability();
  setAuthMode('login');
  showView(authView);
}

init();
