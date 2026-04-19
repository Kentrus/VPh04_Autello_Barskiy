"""Поведенческая аналитика клиента — связь 1:1 с заявкой.

Фронт в фоне собирает метрики (время на странице, клики, hover-зоны),
при отправке заявки шлёт отдельно. По ним видно "тёплый" это лид
(быстро заполнил) или "холодный" (ходил неделю, возвращался).

Модель и API готовы, сам фронт пока не шлёт — это задача VPh06.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Session

from core.database import Base


class BehaviorMetric(Base):
    """
    Метрика поведения, привязана к заявке через уникальный FK → связь 1:1.
    ON DELETE CASCADE — удалили заявку, метрика уходит автоматически.

    CREATE TABLE behavior_metrics (
        id             SERIAL PRIMARY KEY,
        application_id INTEGER NOT NULL UNIQUE
                       REFERENCES applications(id) ON DELETE CASCADE,
        time_on_page   INTEGER DEFAULT 0,
        clicks_count   INTEGER DEFAULT 0,
        hover_zones    TEXT,
        visits_count   INTEGER DEFAULT 1,
        created_at     TIMESTAMPTZ DEFAULT now(),
        updated_at     TIMESTAMPTZ DEFAULT now()
    );
    """

    __tablename__ = "behavior_metrics"

    id = Column(Integer, primary_key=True, index=True)

    # unique=True → один application_id не может появиться дважды (связь 1:1)
    application_id = Column(
        Integer,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    time_on_page = Column(Integer, default=0)
    clicks_count = Column(Integer, default=0)
    # JSON-строка типа {"price_block": 3200, "form": 1100} — секунды/мс на зоне.
    # TEXT вместо JSONB для простоты; если понадобятся запросы по структуре — JSONB.
    hover_zones = Column(Text, nullable=True)
    visits_count = Column(Integer, default=1)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BehaviorMetricCreate(BaseModel):
    """Входные данные от фронта. Дефолты дают "пришёл и сразу отправил"."""
    application_id: int
    time_on_page: int = 0
    clicks_count: int = 0
    hover_zones: str | None = None
    visits_count: int = 1


class BehaviorMetricOut(BehaviorMetricCreate):
    """Ответ API."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


def create_behavior_metric(db: Session, data: BehaviorMetricCreate) -> BehaviorMetric:
    """Сохранить метрику. Если для этой заявки уже есть — IntegrityError (unique)."""
    item = BehaviorMetric(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_behavior_metrics(db: Session) -> list[BehaviorMetric]:
    """Все метрики, свежие сверху."""
    return db.query(BehaviorMetric).order_by(BehaviorMetric.id.desc()).all()


def get_behavior_metric_by_application(db: Session, application_id: int) -> BehaviorMetric | None:
    """Метрика для конкретной заявки — основной сценарий чтения."""
    return (
        db.query(BehaviorMetric)
        .filter(BehaviorMetric.application_id == application_id)
        .first()
    )
