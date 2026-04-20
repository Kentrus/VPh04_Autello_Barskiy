// Фоновый сборщик поведенческих метрик для главной страницы.
//
// Что собирается:
//   * time_on_page    — секунд с момента подключения модуля (таймер через setInterval).
//   * buttons_clicked — JSON-объект { "<cssSelector>": <count>, ... } за последнюю секунду.
//                       Идентификатор элемента — короткий CSS-селектор (id → name → tag).
//   * cursor_positions— JSON-массив [[x,y], ...] — по одному сэмплу в секунду для heatmap.
//
// Раз в секунду (setInterval 1000 мс) шлём POST /api/behavior-metrics,
// После успешной отправки обнуляем «дельты» (clicks и positions за прошлый тик).
// time_on_page шлём кумулятивный — так админке проще посчитать «макс время на странице».
//
// Важно понимать: такой темп шлёт 3600 записей в час с одной вкладки — для
// реального прода многовато, но ТЗ VPh06 просит именно так. Если надоест —
// увеличим интервал или будем батчить.

const API_URL = '/api/behavior-metrics';
const FLUSH_INTERVAL_MS = 1000;

const startedAt = Date.now();

// Счётчик кликов по ключу-селектору: {'button#submit-btn': 3, 'select[name="service"]': 1}
let clicksBuckets = {};

// Массив сэмплов координат за текущий интервал; пополняется 1 раз в секунду
// (см. ниже captureCursorSample) и очищается после успешной отправки.
let cursorSamples = [];

// Последняя известная позиция курсора — обновляется на каждый mousemove.
// Храним только последнюю, чтобы не раздувать массив до размера экрана*fps.
let lastCursor = null;

// --- Отслеживание курсора --------------------------------------------------

window.addEventListener('mousemove', (event) => {
  // Относительные координаты в окне (0..innerWidth, 0..innerHeight).
  // Для heatmap абсолют не нужен — показываем относительно viewport.
  lastCursor = [event.clientX, event.clientY];
}, { passive: true });

function captureCursorSample() {
  // Сэмплируем раз в секунду: если мышь вообще двигалась — кладём последнюю
  // известную позицию, иначе пропускаем (пустая точка исказила бы heatmap).
  if (lastCursor) cursorSamples.push(lastCursor);
}

// --- Отслеживание кликов ---------------------------------------------------

// Один глобальный слушатель в capture-фазе — ловим клики по всему документу,
// не привязываясь к конкретным элементам. Так новые кнопки автоматически
// учитываются без изменений в этом файле.
window.addEventListener('click', (event) => {
  const selector = buildSelectorFor(event.target);
  clicksBuckets[selector] = (clicksBuckets[selector] || 0) + 1;
}, { capture: true });

function buildSelectorFor(el) {
  // Короткий, но уникальный селектор: id > name > tag.
  // Идея: совпадающие клики по «одной и той же кнопке» попадают в один бакет.
  if (!(el instanceof Element)) return 'unknown';
  if (el.id) return `#${el.id}`;
  if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
  return el.tagName.toLowerCase();
}

// --- Отправка на сервер ----------------------------------------------------

async function flush() {
  captureCursorSample();

  // Снимок дельт + сброс локальных накопителей перед запросом.
  // Так даже если сеть медленная и параллельно накопились новые события —
  // они попадут в следующий flush, не затрёт их.
  const clicksSnapshot = clicksBuckets;
  const cursorSnapshot = cursorSamples;
  clicksBuckets = {};
  cursorSamples = [];

  const payload = {
    application_id: 0, // фиктивно — на бэке игнорируется
    time_on_page: Math.floor((Date.now() - startedAt) / 1000),
    buttons_clicked: JSON.stringify(clicksSnapshot),
    cursor_positions: JSON.stringify(cursorSnapshot),
    return_frequency: 0,
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // При ошибке возвращаем дельты обратно, чтобы не потерять — следующий тик ре-отправит всё вместе.
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    console.warn('[behavior-metrics] flush failed:', err);
    // Аккуратное слияние: новые события, которые уже пришли, сохраняем поверх возвращаемых.
    for (const [key, count] of Object.entries(clicksSnapshot)) {
      clicksBuckets[key] = (clicksBuckets[key] || 0) + count;
    }
    cursorSamples = cursorSnapshot.concat(cursorSamples);
  }
}

// Запускаем «тикер» отправки. clearInterval не делаем — модуль живёт столько же,
// сколько страница, браузер сам остановит всё при unload.
setInterval(flush, FLUSH_INTERVAL_MS);
