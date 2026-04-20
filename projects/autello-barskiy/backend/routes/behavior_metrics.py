"""HTTP-эндпоинты для поведенческой аналитики (анонимные метрики).

POST /behavior-metrics — шлёт фронт главной страницы раз в секунду.
GET /behavior-metrics — список последних метрик (для агрегации в админке).

Привязки к заявке (application_id) нет — см. models/behavior_metric.py.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from models.behavior_metric import (
    BehaviorMetricCreate,
    BehaviorMetricOut,
    create_behavior_metric,
    get_behavior_metrics,
)

router = APIRouter(prefix="/behavior-metrics", tags=["behavior-metrics"])


@router.post("", response_model=BehaviorMetricOut, status_code=201)
def create(data: BehaviorMetricCreate, db: Session = Depends(get_db)):
    """Сохранить метрику. application_id из input игнорируется."""
    return create_behavior_metric(db, data)


@router.get("", response_model=list[BehaviorMetricOut])
def list_all(
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
):
    """Последние метрики, свежие сверху. skip/limit для пагинации в админке."""
    items = get_behavior_metrics(db, limit=skip + limit)
    return items[skip:skip + limit]
