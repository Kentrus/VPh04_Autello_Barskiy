"""Каталог услуг компании — настройки админа.

Фронт при загрузке страницы дёргает GET /admin-settings и динамически
строит выпадашку услуг и подставляет диапазоны бюджета.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.orm import Session

from core.database import Base


class AdminSetting(Base):
    """
    Одна запись = одна услуга. Решение "запись на услугу" (а не JSON-массив в
    одной строке) даёт чистый CRUD: добавить/удалить/редактировать услугу —
    обычная операция над строкой таблицы.

    CREATE TABLE admin_settings (
        id           SERIAL PRIMARY KEY,
        services     VARCHAR(255) NOT NULL,
        budget_range VARCHAR(100) NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT now(),
        updated_at   TIMESTAMPTZ DEFAULT now()
    );
    """

    __tablename__ = "admin_settings"

    id = Column(Integer, primary_key=True, index=True)
    services = Column(String(255), nullable=False)
    budget_range = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AdminSettingCreate(BaseModel):
    """Входные данные для POST /admin-settings."""
    services: str
    budget_range: str


class AdminSettingUpdate(BaseModel):
    """Входные данные для PUT /admin-settings/{id}.

    Отдельная схема от Create — оба поля обязательны, но семантически
    это «заменить», а не «создать». Не делаем поля Optional: для частичного
    обновления пришлось бы использовать PATCH, а admin-панель редактирует
    строку целиком и так проще и предсказуемее.
    """
    services: str
    budget_range: str


class AdminSettingOut(AdminSettingCreate):
    """Ответ API с id и метаданными."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


def create_admin_setting(db: Session, data: AdminSettingCreate) -> AdminSetting:
    """Добавить услугу в каталог."""
    item = AdminSetting(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_admin_settings(db: Session) -> list[AdminSetting]:
    """Весь каталог по возрастанию id — в таком же порядке услуги рисуются в выпадашке."""
    return db.query(AdminSetting).order_by(AdminSetting.id.asc()).all()


def get_admin_setting(db: Session, item_id: int) -> AdminSetting | None:
    """Одна услуга по id или None."""
    return db.query(AdminSetting).filter(AdminSetting.id == item_id).first()


def update_admin_setting(
    db: Session, item_id: int, data: AdminSettingUpdate
) -> AdminSetting | None:
    """Изменить услугу. None — если не найдена."""
    item = get_admin_setting(db, item_id)
    if item is None:
        return None
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_admin_setting(db: Session, item_id: int) -> bool:
    """Удалить услугу. True — удалена, False — не найдена."""
    item = get_admin_setting(db, item_id)
    if item is None:
        return False
    db.delete(item)
    db.commit()
    return True
