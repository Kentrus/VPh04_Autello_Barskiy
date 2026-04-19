import './styles.css';

const API_BASE = '/api';

const form = document.getElementById('application-form');
const serviceSelect = document.getElementById('service-select');
const budgetInput = document.getElementById('budget-input');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('form-status');

const services = new Map();

async function loadServices() {
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

serviceSelect.addEventListener('change', () => {
  const selected = serviceSelect.value;
  const range = services.get(selected);
  if (range) budgetInput.value = range;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const payload = {};
  for (const [key, value] of formData.entries()) {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    if (trimmed !== '') payload[key] = trimmed;
  }

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

loadServices();
