"""Подключение к PostgreSQL через SQLAlchemy.

Engine — один на всё приложение (управляет пулом соединений).
SessionLocal — фабрика сессий, одна сессия на HTTP-запрос через Depends(get_db).
Base — родитель всех ORM-моделей, по нему create_all находит таблицы.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import settings

# pool_pre_ping — тихо проверяет соединение перед использованием.
# Без этого после рестарта Postgres первый запрос падает с OperationalError.
engine = create_engine(settings.database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def get_db():
    """FastAPI-dependency: выдаёт сессию на запрос и гарантированно закрывает её."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
