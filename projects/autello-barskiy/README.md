# Autéllo Barskiy — сайт приёма заявок

Веб-сервис премиум-автосервиса на FastAPI + vanilla JS + webpack + Nginx + Postgres. Собран в рамках кейса «Сайт для обработки заказов от покупателей» (VPh05, модуль 8).

## Что умеет

- Публичный сайт с формой заявки (главная страница)
- Выпадающий список услуг — **динамически** подтягивается из БД через `GET /api/admin-settings`
- При выборе услуги — автоматически подставляется диапазон бюджета
- Отправка заявки — `POST /api/applications`, сохранение в Postgres
- Swagger UI на `/docs` для ручного тестирования и администрирования каталога услуг
- Белая тема с округлым шрифтом (Nunito с Google Fonts) и фоновой анимацией из золотых кружков

## Архитектура

```
[Браузер]
    │ http://localhost:8080
    ▼
[Nginx (autello-web)]  — раздаёт frontend/dist/ + проксирует /api → backend
    │ /api/*  /docs  /openapi.json
    ▼
[FastAPI (autello-backend)]  — приватный, наружу не торчит
    │ SQLAlchemy
    ▼
[PostgreSQL (autello-db)]
```

**Принцип приватности:** backend не публикует `ports:` в docker-compose — дверь одна, через Nginx. API недоступно напрямую из интернета.

## Структура

```
projects/autello-barskiy/
├── README.md                ← этот файл
├── docker-compose.yml       ← db + backend + web
├── .env.example             ← шаблон переменных
├── nginx/
│   └── default.conf         ← конфиг Nginx проекта
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py              ← сборка FastAPI
│   ├── core/
│   │   ├── config.py        ← чтение переменных окружения
│   │   └── database.py      ← SQLAlchemy engine + сессии
│   ├── models/              ← одна модель = один файл (SQLAlchemy + Pydantic + CRUD)
│   │   ├── application.py        ← заявка клиента
│   │   ├── admin_setting.py      ← каталог услуг и бюджеты
│   │   └── behavior_metric.py    ← аналитика поведения (1:1 к заявке)
│   ├── routes/              ← по роуту на модель
│   │   ├── applications.py
│   │   ├── admin_settings.py
│   │   └── behavior_metrics.py
│   └── seed_services.py     ← одноразовый скрипт заливки 10 услуг
└── frontend/
    ├── package.json
    ├── webpack.config.js
    └── src/
        ├── index.html       ← шаблон страницы
        ├── index.js         ← логика формы + fetch API
        └── styles.css       ← белая тема + анимация
```

## Модели данных

### `applications` — заявка клиента

| Поле | Тип | Описание |
|---|---|---|
| `id` | PK | serial |
| `last_name`, `first_name`, `middle_name` | VARCHAR | ФИО |
| `business_niche`, `company_size`, `task_scope`, `role` | VARCHAR | квалификация |
| `budget`, `service`, `deadline` | VARCHAR | параметры услуги |
| `preferred_contact`, `contact_time` | VARCHAR | способ связи |
| `comment` | TEXT | свободный комментарий |
| `created_at`, `updated_at` | TIMESTAMPTZ | авто |

### `admin_settings` — каталог услуг

| Поле | Тип |
|---|---|
| `id` | PK |
| `services` | VARCHAR (название) |
| `budget_range` | VARCHAR (диапазон) |

### `behavior_metrics` — аналитика (пока не используется фронтом)

| Поле | Тип |
|---|---|
| `id` | PK |
| `application_id` | FK → applications, UNIQUE, CASCADE |
| `time_on_page`, `clicks_count`, `visits_count` | INT |
| `hover_zones` | TEXT (JSON-строка) |

## Запуск локально (Windows + Docker Desktop)

### 1. Создать `.env`

```bash
cd projects/autello-barskiy
cp .env.example .env
```

Для локали подойдут дефолтные значения из `.env.example`.

### 2. Собрать frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

Появится `frontend/dist/` — это то, что Nginx будет раздавать.

### 3. Поднять стек

```bash
docker compose up -d --build
```

Три контейнера: `autello-db`, `autello-backend`, `autello-web`.

### 4. Залить начальные услуги

```bash
docker cp backend/seed_services.py autello-backend:/app/seed_services.py
docker exec autello-backend python seed_services.py
```

В таблице `admin_settings` появится 10 элитных услуг.

### 5. Проверка

- http://localhost:8080 — публичный сайт с формой
- http://localhost:8080/docs — Swagger для администрирования
- http://localhost:8080/api/admin-settings — JSON со списком услуг

## Основные эндпоинты API

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/applications` | создать заявку |
| GET | `/applications` | список заявок (админ) |
| GET | `/applications/{id}` | одна заявка |
| POST | `/admin-settings` | добавить услугу |
| GET | `/admin-settings` | список услуг (фронт дёргает при загрузке) |
| DELETE | `/admin-settings/{id}` | удалить услугу |
| POST | `/behavior-metrics` | записать метрику поведения |
| GET | `/health` | healthcheck |

## Как это чинилось в процессе (типовые грабли)

**`POST /applications/` возвращает 307 → 405.** FastAPI по умолчанию редиректит `/applications` → `/applications/`, теряя префикс `/api` от nginx. Фикс: `redirect_slashes=False` в FastAPI + объявляем пути **без** trailing slash.

**CSS 404.** По умолчанию `style-loader` инлайнит стили в JS. Для продакшена нужен `mini-css-extract-plugin` + `publicPath: '/'` в webpack — иначе браузер ищет стили по неверному пути.

**500 при успешной записи в БД.** ValidationError в response-схеме Pydantic — данные закоммитились, но ответ не собрался. Ищется в `docker logs -f autello-backend`, чинится `from_attributes=True` в `ConfigDict`.

## Известные ограничения

- **Нет HTTPS** локально (только в проде, если настроен Let's Encrypt)
- **Аутентификации нет** — Swagger и админ-эндпоинты публичные. Админка на `/admin` с логином — следующий урок.
- **Поведенческая аналитика** — модель и API готовы, но фронт пока не шлёт метрики
- **CORS — `allow_origins=["*"]`** — для dev-режима. В проде надо сузить до домена.
- **Нет миграций Alembic** — таблицы создаются через `Base.metadata.create_all()`. Годится для учебного, не для эволюции схемы.
- **`seed_services.py`** — одноразовый скрипт, не фикстуры. Переливать каталог — руками.

## Планы развития (VPh06+)

- Админ-панель на `/admin` с авторизацией
- Отправка `behavior_metrics` с фронта (время на странице, клики, hover-зоны)
- Let's Encrypt на поддомен `autello.otiva.ru`
- Закрыть Swagger/`/docs` в проде за auth
- Миграции через Alembic
- E2E-тесты формы

## Ссылки

- Репозиторий: https://github.com/Kentrus/VPh04_Autello_Barskiy
- Инфра (Part 1): [../../README.md](../../README.md)
- Скриншоты: [../../screenshots/VPh05/](../../screenshots/VPh05/)
