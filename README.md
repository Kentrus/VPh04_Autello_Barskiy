# Autéllo Barskiy — платформа и проект

Модуль 8 курса «Профессия вайб-кодер» (Zerocoder). Кейс «Сайт для обработки заказов от покупателей» — в двух частях:

- **VPh04. Часть 1:** инфраструктура — «докеризированный монолит» на VPS.
- **VPh05. Часть 2:** приложение Autéllo Barskiy — FastAPI + webpack-фронт, подключается к общей инфре.

Репозиторий один на весь кейс, развивается от части к части.

## Архитектура

```
[интернет]
    ▼ :80, :443
[Nginx (infra)]  — единая входная дверь на VPS
    ├── otiva.ru/             → заглушка "Infra platform is running"
    └── autello.otiva.ru/     → проект autello (planned)
            ├── /              → frontend/dist (статика)
            └── /api/*         → FastAPI backend (приватный, только во внутренней сети)
                    └── PostgreSQL (infra-postgres, приватный)
```

**Общая платформа** — на одном VPS живут разные проекты через docker-сеть `shared-network`. Backend и БД наружу не торчат, только Nginx.

Планируемые соседи на сервере:
- `projects/autello-barskiy/` — сайт Autéllo Barskiy (VPh05+)
- `projects/chatbot/` — чат-бот (планируется)
- `projects/company/` — сайт компании (планируется)

## Структура репозитория

```
VPh04_Autello_Barskiy_Part1/
├── README.md                    ← этот файл
├── .gitignore
├── screenshots/
│   ├── VPh04/                   ← скриншоты Part 1 (инфра)
│   └── VPh05/                   ← скриншоты Part 2 (приложение)
├── infra/                       ← Часть 1: платформа
│   ├── docker-compose.yml       ← nginx + postgres + pgadmin + registry + watchtower
│   ├── .env.example
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── conf.d/_default.conf
│   ├── postgres/init/
│   └── registry/create-user.sh
└── projects/                    ← Часть 2+: прикладные проекты
    └── autello-barskiy/         ← сайт приёма заявок (VPh05)
        ├── README.md            ← детальная документация проекта
        ├── docker-compose.yml
        ├── backend/             ← FastAPI + 3 модели
        ├── frontend/            ← webpack + vanilla JS
        └── nginx/default.conf
```

---

## Часть 1 — Инфраструктура (VPh04)

### Что развёрнуто

- **Nginx** — reverse-proxy, единственная публичная точка
- **PostgreSQL 16** — БД для всех проектов платформы
- **pgAdmin** — веб-админка БД (порт 5050)
- **Watchtower** (fork `nickfedor/watchtower`) — автообновление контейнеров с label-фильтром
- **Docker Registry** с htpasswd-авторизацией (порт 5000) — свой приватный реестр

### Развёртывание на новом сервере

#### Предусловия

- Ubuntu 22.04 LTS на VPS
- Доступ root по SSH-ключу
- Docker + `docker compose` установлены

#### Шаги

На сервере должно получиться:

```
/root/
├── infra/                      ← платформа
└── projects/
    └── autello-barskiy/        ← проект (VPh05+)
```

```bash
# 1. Клонировать репо во временную папку
git clone https://github.com/Kentrus/VPh04_Autello_Barskiy.git /tmp/repo

# 2. Перенести infra и project на свои места
mv /tmp/repo/infra /root/infra
mkdir -p /root/projects
mv /tmp/repo/projects/autello-barskiy /root/projects/autello-barskiy
rm -rf /tmp/repo

# 3. Заполнить .env для infra
cd /root/infra
cp .env.example .env
nano .env

# 4. Создать учётку для Registry
chmod +x registry/create-user.sh
./registry/create-user.sh admin <strong-password>

# 5. Запустить инфру
docker compose up -d
docker ps

# 6. Запустить проект (после инфры)
cd /root/projects/autello-barskiy
cp .env.example .env  # заполнить реальными паролями от autello_db
docker compose -f docker-compose.prod.yml up -d
```

#### Как обновлять после правок в репо

- **Код приложения (backend/frontend):** локально `docker compose build && push` → Watchtower сам подтянет в течение минуты.
- **Инфра (nginx conf, compose):** клонирование через `/tmp`, ручной `cp` нужных файлов в `/root/infra/`, `docker exec infra-nginx nginx -s reload` или `docker compose up -d` в `/root/infra/`.

#### Проверки

- `http://<ip>/` → "Infra platform is running"
- `http://<ip>:5050` → pgAdmin (логин/пароль из `.env`)
- `http://<ip>:5000/v2/_catalog` → `{"repositories":[]}` (требует авторизации)

### Безопасность

- `.env` не коммитится (см. `.gitignore`)
- SSH только по ключу, пароль отключён
- Postgres не открыт наружу
- Registry — htpasswd
- pgAdmin — логин/пароль

### Известные ограничения Part 1

- HTTPS настроен для поддоменов `autello.otiva.ru` и `registry.otiva.ru` (Let's Encrypt через certbot с автопродлением каждые 12ч через webroot). Для самого `otiva.ru` — пока HTTP-заглушка
- pgAdmin пока доступен по IP:5050, Registry — через HTTPS на `registry.otiva.ru`
- Watchtower обновляет только помеченные контейнеры (чтобы не перезапускать БД)
- Watchtower авторизован в приватном Registry через монтирование `/root/.docker/config.json`
- Нет автобэкапов Postgres

---

## Часть 2 — Приложение Autéllo Barskiy (VPh05)

Подробная документация: **[`projects/autello-barskiy/README.md`](projects/autello-barskiy/README.md)**.

### Что сделано

- **Backend (FastAPI)** с тремя моделями: `applications`, `admin_settings`, `behavior_metrics`. Каждая модель — отдельный файл с SQLAlchemy-классом, Pydantic-схемами и CRUD-функциями. Роуты в отдельных файлах, собираются в `main.py`.
- **Frontend (webpack + vanilla JS)** с белой темой, округлым шрифтом Nunito и фоновой анимацией из золотых кружков. Форма заявки с выпадашкой услуг (динамически из БД) и автозаполнением бюджета.
- **Nginx-контейнер проекта** раздаёт `dist/` и проксирует `/api/*` в backend. Backend наружу не торчит.
- **10 премиум-услуг** залиты в каталог через скрипт `seed_services.py`.
- **Решены типовые ошибки урока:** 307→405 redirect loop (FastAPI `redirect_slashes=False` + пути без trailing slash), CSS 404 (`mini-css-extract-plugin` + `publicPath: '/'`), 500 при успешной записи (`ConfigDict(from_attributes=True)` в Pydantic).

### Быстрый старт локально

```bash
cd projects/autello-barskiy
cp .env.example .env

cd frontend && npm install && npm run build && cd ..
docker compose up -d --build

# Залить 10 услуг в каталог
docker cp backend/seed_services.py autello-backend:/app/seed_services.py
docker exec autello-backend python seed_services.py
```

- http://localhost:8080 — сайт
- http://localhost:8080/docs — Swagger

### Деплой на otiva.ru — DONE

Сайт живёт на **https://autello.otiva.ru/**. Схема деплоя:

1. Локально: `docker compose build && docker compose push` → образы летят в `https://registry.otiva.ru`
2. На сервере при первом деплое: `docker compose -f docker-compose.prod.yml pull && up -d`
3. При последующих обновлениях: Watchtower сам подхватывает новую версию из Registry и рестартует контейнеры (интервал 60 сек, только контейнеры с меткой `com.centurylinklabs.watchtower.enable=true`)

На сервере backend не торчит наружу — доступен только внутри `shared-network`, публикуется через `infra-nginx` с SSL-терминацией.

### Известные ограничения Part 2

- Нет аутентификации — `/docs` и админские эндпоинты публичны
- Поведенческая аналитика — модель готова, но фронт её пока не шлёт
- CORS — `allow_origins=["*"]`, не для прода
- Нет миграций (Alembic) — таблицы через `Base.metadata.create_all()`
- Админка на `/admin` с авторизацией — следующий урок

---

## Планы развития

- **VPh06:** админка на `/admin`, поведенческая аналитика
- **Безопасность:** UFW-firewall, fail2ban для брутфорса SSH и Registry
- **HTTPS на главном `otiva.ru`** (сейчас HTTP-заглушка)
- **Эксплуатация:** cron-бэкапы Postgres, мониторинг (uptime, healthcheck-агрегация)
- **Расширение платформы:** второй проект в `projects/chatbot/`

## Ссылки

- GitHub: [Kentrus](https://github.com/Kentrus)
- Репо этого кейса: https://github.com/Kentrus/VPh04_Autello_Barskiy
- Техническое задание: платформа Zerocoder (уроки VPh04, VPh05)
