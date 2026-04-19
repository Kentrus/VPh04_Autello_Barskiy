"""HTTP-эндпоинты для работы с заявками.

Тонкий слой: парсинг запроса → вызов CRUD → сериализация ответа.
Никакой бизнес-логики здесь — вся она в models/application.py.

Путь объявляется БЕЗ trailing slash: "/applications", а не "/applications/".
Вкупе с redirect_slashes=False в main.py это убирает ловушку 307 → 405,
когда nginx режет префикс /api, а FastAPI редиректит на версию со слешем.
"""
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
    """Создать заявку. Возвращает 201 Created с телом заявки (включая id)."""
    return create_application(db, data)


@router.get("", response_model=list[ApplicationOut])
def list_all(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Список заявок с пагинацией."""
    return get_applications(db, skip=skip, limit=limit)


@router.get("/{app_id}", response_model=ApplicationOut)
def retrieve(app_id: int, db: Session = Depends(get_db)):
    """Одна заявка по id; 404 если нет."""
    app = get_application(db, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return app
