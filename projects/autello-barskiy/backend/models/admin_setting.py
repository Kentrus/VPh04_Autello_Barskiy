from datetime import datetime

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.orm import Session

from core.database import Base


class AdminSetting(Base):
    """
    Настройки услуг, которые заполняет админ. Фронт читает эту таблицу
    и динамически строит выпадашку услуг и ползунок бюджета.

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
    services: str
    budget_range: str


class AdminSettingOut(AdminSettingCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


def create_admin_setting(db: Session, data: AdminSettingCreate) -> AdminSetting:
    item = AdminSetting(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_admin_settings(db: Session) -> list[AdminSetting]:
    return db.query(AdminSetting).order_by(AdminSetting.id.asc()).all()


def get_admin_setting(db: Session, item_id: int) -> AdminSetting | None:
    return db.query(AdminSetting).filter(AdminSetting.id == item_id).first()


def delete_admin_setting(db: Session, item_id: int) -> bool:
    item = get_admin_setting(db, item_id)
    if item is None:
        return False
    db.delete(item)
    db.commit()
    return True
