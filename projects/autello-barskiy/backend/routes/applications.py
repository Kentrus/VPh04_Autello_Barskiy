from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models.application import (
    ApplicationCreate,
    ApplicationOut,
    create_application,
    get_application,
    get_applications,
)

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post("", response_model=ApplicationOut, status_code=201)
def create(data: ApplicationCreate, db: Session = Depends(get_db)):
    return create_application(db, data)


@router.get("", response_model=list[ApplicationOut])
def list_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_applications(db, skip=skip, limit=limit)


@router.get("/{app_id}", response_model=ApplicationOut)
def retrieve(app_id: int, db: Session = Depends(get_db)):
    app = get_application(db, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return app
