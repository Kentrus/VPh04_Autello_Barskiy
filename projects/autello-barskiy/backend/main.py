"""Точка входа FastAPI — собирает приложение и подключает роуты.

Запуск в контейнере: uvicorn main:app --host 0.0.0.0 --port 8000.
Снаружи backend не виден — только через infra-nginx на autello.otiva.ru/api.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import Base, engine
from routes import admin_settings, applications, behavior_metrics

# Создание недостающих таблиц при старте. Для учебного достаточно;
# для прод-эволюции схемы нужны миграции (Alembic) — пока не делаем.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Autéllo Barskiy API",
    description="Backend для сайта обработки заявок премиум-автосервиса",
    version="0.1.1",
    # False — страховка от ловушки 307 → 405. Когда nginx передаёт /api/applications,
    # FastAPI не будет перенаправлять на /applications/, и цепочка редиректов не ломается.
    redirect_slashes=False,
)

# Для dev разрешаем любые источники — упрощает локальную работу из браузера.
# В проде сузить до своих доменов, но через infra-nginx это уже неактуально:
# все запросы приходят с того же origin, что и фронт.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applications.router)
app.include_router(admin_settings.router)
app.include_router(behavior_metrics.router)


@app.get("/health")
def health():
    """Простой healthcheck для docker-compose и мониторинга."""
    return {"status": "ok"}
