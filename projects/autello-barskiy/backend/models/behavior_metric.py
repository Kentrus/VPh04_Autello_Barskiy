"""Поведенческая аналитика клиента — анонимные метрики страницы заявки.

Раньше была связь 1:1 с конкретной заявкой через FK + UNIQUE, но по ТЗ VPh06
метрики собираются анонимно каждую секунду (время на странице, клики,
позиция курсора для heatmap) — никакой привязки к конкретной заявке нет.
Поэтому модель теперь плоская: каждый POST = одна строка, без FK и UNIQUE.

Поле `application_id` во входной схеме осталось (фронт его шлёт), но
сознательно игнорируется — в БД не сохраняется. Так решаем проблему
совместимости без переделки клиента.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, DateTime, Integer, Text, func
from sqlalchemy.orm import Session

from core.database import Base


class BehaviorMetric(Base):
    """
    CREATE TABLE behavior_metrics (
        id                SERIAL PRIMARY KEY,
        time_on_page      INTEGER DEFAULT 0,   -- секунд с момента загрузки страницы
        buttons_clicked   TEXT,                -- JSON: {"selector": count, ...}
        cursor_positions  TEXT,                -- JSON: [[x,y], ...] за последнюю секунду
        return_frequency  INTEGER DEFAULT 0,   -- сейчас фронт шлёт 0; задел на будущее
        created_at        TIMESTAMPTZ DEFAULT now()
    );
    """

    __tablename__ = "behavior_metrics"

    id = Column(Integer, primary_key=True, index=True)
    time_on_page = Column(Integer, default=0)
    # TEXT, а не JSONB — данные мы никогда не фильтруем по структуре,
    # а хранить сырой JSON проще, чем городить отдельные таблицы.
    buttons_clicked = Column(Text, nullable=True)
    cursor_positions = Column(Text, nullable=True)
    return_frequency = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BehaviorMetricCreate(BaseModel):
    """Вход POST /behavior-metrics.

    application_id оставлен для совместимости с тем форматом, который уже
    знает фронт (см. ТЗ VPh06). На бэкенде мы его полностью игнорируем —
    не пишем в БД и не валидируем наличие заявки с таким id.
    """
    application_id: int = 0
    time_on_page: int = 0
    buttons_clicked: str | None = None
    cursor_positions: str | None = None
    return_frequency: int = 0


class BehaviorMetricOut(BaseModel):
    """Ответ API. application_id не возвращаем — его в БД и нет."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    time_on_page: int
    buttons_clicked: str | None
    cursor_positions: str | None
    return_frequency: int
    created_at: datetime


def create_behavior_metric(db: Session, data: BehaviorMetricCreate) -> BehaviorMetric:
    """Сохранить метрику. application_id из input игнорируется — в БД его нет."""
    item = BehaviorMetric(
        time_on_page=data.time_on_page,
        buttons_clicked=data.buttons_clicked,
        cursor_positions=data.cursor_positions,
        return_frequency=data.return_frequency,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_behavior_metrics(db: Session, limit: int = 10000) -> list[BehaviorMetric]:
    """Все метрики, свежие сверху. limit нужен, потому что строки копятся быстро
    (раз в секунду с каждой открытой вкладки) — не отдаём весь лог целиком."""
    return (
        db.query(BehaviorMetric)
        .order_by(BehaviorMetric.id.desc())
        .limit(limit)
        .all()
    )
