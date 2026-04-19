from datetime import datetime

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Session

from core.database import Base


class BehaviorMetric(Base):
    """
    Аналитика поведения клиента на странице. Связь 1:1 с заявкой по application_id.

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
    application_id = Column(
        Integer,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    time_on_page = Column(Integer, default=0)
    clicks_count = Column(Integer, default=0)
    hover_zones = Column(Text, nullable=True)
    visits_count = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BehaviorMetricCreate(BaseModel):
    application_id: int
    time_on_page: int = 0
    clicks_count: int = 0
    hover_zones: str | None = None
    visits_count: int = 1


class BehaviorMetricOut(BehaviorMetricCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


def create_behavior_metric(db: Session, data: BehaviorMetricCreate) -> BehaviorMetric:
    item = BehaviorMetric(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_behavior_metrics(db: Session) -> list[BehaviorMetric]:
    return db.query(BehaviorMetric).order_by(BehaviorMetric.id.desc()).all()


def get_behavior_metric_by_application(db: Session, application_id: int) -> BehaviorMetric | None:
    return (
        db.query(BehaviorMetric)
        .filter(BehaviorMetric.application_id == application_id)
        .first()
    )
