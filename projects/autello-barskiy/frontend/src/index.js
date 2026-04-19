// Клиентская логика сайта Autéllo Barskiy.
// 1. При загрузке: GET /api/admin-settings → наполняем выпадашку услуг.
// 2. При выборе услуги: автоподставляем budget_range в поле "Бюджет".
// 3. При сабмите: POST /api/applications с данными формы → показываем успех/ошибку.

import './styles.css';

// Относительный путь — infra-nginx сам проксирует /api/* в backend.
// Меняем ТОЛЬКО здесь, если API переедет на другой путь.
const API_BASE = '/api';

const form = document.getElementById('application-form');
const serviceSelect = document.getElementById('service-select');
const budgetInput = document.getElementById('budget-input');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('form-status');

// Хранит соответствие "название услуги → диапазон бюджета" для автоподстановки.
const services = new Map();

async function loadServices() {
  // Наполняем выпадашку услуг из каталога в БД.
  // Если API недоступен или каталог пуст — показываем соответствующую плашку.
  try {
    const response = await fetch(`${API_BASE}/admin-settings`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const items = await response.json();
    if (!items.length) {
      serviceSelect.innerHTML = '<option value="" disabled selected>Услуги пока не настроены</option>';
      return;
    }

    services.clear();
    serviceSelect.innerHTML = '<option value="" disabled selected>— выберите услугу —</option>';
    items.forEach((item) => {
      services.set(item.services, item.budget_range);
      const option = document.createElement('option');
      option.value = item.services;
      option.textContent = `${item.services}  (${item.budget_range})`;
      serviceSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Failed to load services:', err);
    serviceSelect.innerHTML = '<option value="" disabled selected>Ошибка загрузки услуг</option>';
  }
}

// При выборе услуги — подставляем её ценовой диапазон в поле "Бюджет".
// Пользователь может отредактировать вручную при необходимости.
serviceSelect.addEventListener('change', () => {
  const selected = serviceSelect.value;
  const range = services.get(selected);
  if (range) budgetInput.value = range;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Нативная проверка required-полей; если что-то пропущено — браузер сам подсветит.
  if (!form.reportValidity()) return;

  // Собираем только непустые поля: бэкенд ждёт отсутствие ключа, а не пустую строку.
  const formData = new FormData(form);
  const payload = {};
  for (const [key, value] of formData.entries()) {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    if (trimmed !== '') payload[key] = trimmed;
  }

  // Блокируем кнопку на время запроса, показываем промежуточный статус.
  submitBtn.disabled = true;
  statusEl.className = 'form__status';
  statusEl.textContent = 'Отправляем…';

  try {
    const response = await fetch(`${API_BASE}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`HTTP ${response.status}: ${detail}`);
    }

    statusEl.classList.add('success');
    statusEl.textContent = '✓ Заявка отправлена! Мы свяжемся с вами в ближайшее время.';
    form.reset();
    // form.reset() не сбрасывает select с disabled-первой-опцией и не очищает readonly-подобные поля —
    // поэтому явно обнуляем их для чистого UI.
    serviceSelect.value = '';
    budgetInput.value = '';
  } catch (err) {
    console.error('Submit failed:', err);
    statusEl.classList.add('error');
    statusEl.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь с нами напрямую.';
  } finally {
    submitBtn.disabled = false;
  }
});

// Стартуем наполнение услуг сразу при загрузке модуля.
loadServices();
