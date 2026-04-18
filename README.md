# VPh04. Autéllo Barskiy — Часть 1: Инфраструктура

Модуль 8 курса «Профессия вайб-кодер» (Zerocoder). Первый урок кейса «Сайт для обработки заказов от покупателей».

## Задача урока

Развернуть базовую инфраструктуру («докеризированный монолит») на одном VPS:

- **Nginx** — входная точка, reverse-proxy
- **PostgreSQL** — БД для заявок клиентов
- **pgAdmin** — веб-админка Postgres
- **Watchtower** — автообновление контейнеров
- **Docker Registry (локальный)** — свой приватный реестр образов

Внешний мир видит **только Nginx** (порты 80/443) и админку pgAdmin/Registry. Backend и БД спрятаны во внутренней docker-сети.

## Архитектурное решение

Этот `docker-compose.yml` — **общая платформа** для нескольких проектов, не сервис под один бизнес. На том же сервере потом будут жить:

- `projects/autello-barskiy/` — сайт Autéllo Barskiy (VPh05, VPh06)
- `projects/chatbot/` — чат-бот
- `projects/company/` — сайт компании

Все подключаются к **общей** инфраструктуре через docker-сеть `shared-network`.

## Структура репозитория

```
VPh04_Autello_Barskiy_Part1/
├── README.md                    ← этот файл
├── .gitignore                   ← что не коммитить
├── screenshots/                 ← скриншоты для сдачи ДЗ
└── infra/                       ← платформа (поднимается на сервере)
    ├── docker-compose.yml       ← все сервисы
    ├── .env.example             ← шаблон переменных (коммитится)
    ├── .env                     ← реальные пароли (НЕ коммитится)
    ├── nginx/
    │   ├── nginx.conf           ← главный конфиг
    │   └── conf.d/
    │       └── _default.conf    ← заглушка "It works"
    ├── postgres/
    │   └── init/                ← SQL-скрипты при первом запуске (опционально)
    └── registry/
        ├── create-user.sh       ← создаёт пользователя для push в Registry
        └── auth/
            └── htpasswd         ← сгенерирован create-user.sh, НЕ коммитится
```

## Как развернуть на новом сервере

### Предусловия

- Ubuntu 22.04 LTS на VPS
- Доступ root по SSH
- Docker и плагин `docker compose` установлены

### 1. Скопировать репозиторий на сервер

```bash
git clone https://github.com/Kentrus/VPh04_Autello_Barskiy_Part1.git
mv VPh04_Autello_Barskiy_Part1/infra /root/infra
cd /root/infra
```

### 2. Создать `.env` с реальными паролями

```bash
cp .env.example .env
nano .env  # заполни реальными значениями
```

### 3. Создать пользователя для Docker Registry

```bash
chmod +x registry/create-user.sh
./registry/create-user.sh admin <твой-сильный-пароль>
```

### 4. Запустить стек

```bash
docker compose up -d
docker ps  # все контейнеры должны быть UP
```

### 5. Проверить работу

- **Nginx (заглушка):** `http://<ip-сервера>/` → должна быть надпись "Infra platform is running"
- **pgAdmin:** `http://<ip-сервера>:5050` → вход по `PGADMIN_EMAIL/PGADMIN_PASSWORD` из `.env`
- **Docker Registry:** `http://<ip-сервера>:5000/v2/_catalog` → нужна авторизация, должен вернуть `{"repositories":[]}`

### 6. (На ноутбуке) Залогиниться в свой Registry

```bash
docker login <ip-сервера>:5000
# username: admin
# password: тот, что задал в create-user.sh
```

## Основные команды

| Команда | Что делает |
|---|---|
| `docker compose up -d` | Запустить все сервисы в фоне |
| `docker compose down` | Остановить и удалить контейнеры (volume'ы остаются) |
| `docker compose restart <service>` | Рестарт одного сервиса |
| `docker compose logs -f <service>` | Смотреть логи в реальном времени |
| `docker ps` | Список запущенных контейнеров |
| `docker volume ls` | Список volume'ов (данные БД, реестра и т.д.) |

## Безопасность

- `.env` с паролями **не коммитится** — в `.gitignore`
- SSH-доступ к серверу — только по ключу, пароль отключён
- Postgres не открыт наружу, только внутри docker-сети
- Registry требует авторизации (htpasswd)
- pgAdmin защищён логином/паролем

## Известные ограничения (для учебной версии)

- **Нет HTTPS** — пока HTTP. Let's Encrypt подключим в следующей части
- **pgAdmin и Registry доступны по IP:порт**, без поддоменов и SSL — тоже в следующей части
- **Watchtower отслеживает только контейнеры с label** `com.centurylinklabs.watchtower.enable=true` — чтобы случайно не перезапускать базу данных
- **Нет автоматических бэкапов Postgres** — добавим отдельной задачей

## Планы развития

- VPh05/VPh06: приложение Autéllo Barskiy (бэкенд + фронт) в `projects/autello-barskiy/`
- HTTPS через Let's Encrypt (certbot)
- UFW-firewall (закрыть всё кроме 22/80/443)
- fail2ban (защита от брутфорса SSH)
- Cron-бэкапы Postgres
- Мониторинг (healthcheck + uptime)

## Ссылки

- Репозитории предыдущих уроков: [Kentrus](https://github.com/Kentrus)
- Техническое задание: внутри урока курса на платформе Zerocoder
