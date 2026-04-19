from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models.behavior_metric import (
    BehaviorMetricCreate,
    BehaviorMetricOut,
    create_behavior_metric,
    get_behavior_metric_by_application,
    get_behavior_metrics,
)

router = APIRouter(prefix="/behavior-metrics", tags=["behavior-metrics"])


@router.post("", response_model=BehaviorMetricOut, status_code=201)
def create(data: BehaviorMetricCreate, db: Session = Depends(get_db)):
    return create_behavior_metric(db, data)


@router.get("", response_model=list[BehaviorMetricOut])
def list_all(db: Session = Depends(get_db)):
    return get_behavior_metrics(db)


@router.get("/by-application/{application_id}", response_model=BehaviorMetricOut)
def by_application(application_id: int, db: Session = Depends(get_db)):
    item = get_behavior_metric_by_application(db, application_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Metric not found for this application")
    return item
