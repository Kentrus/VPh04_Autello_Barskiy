"""HTTP-эндпоинты для каталога услуг.

GET /admin-settings — публичный, фронт дёргает при загрузке страницы,
чтобы наполнить выпадашку услуг. POST/DELETE сейчас открытые — в VPh06
закроем под авторизацию.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models.admin_setting import (
    AdminSettingCreate,
    AdminSettingOut,
    create_admin_setting,
    delete_admin_setting,
    get_admin_setting,
    get_admin_settings,
)

router = APIRouter(prefix="/admin-settings", tags=["admin-settings"])


@router.post("", response_model=AdminSettingOut, status_code=201)
def create(data: AdminSettingCreate, db: Session = Depends(get_db)):
    """Добавить услугу в каталог."""
    return create_admin_setting(db, data)


@router.get("", response_model=list[AdminSettingOut])
def list_all(db: Session = Depends(get_db)):
    """Все услуги каталога — фронт строит из этого выпадающий список."""
    return get_admin_settings(db)


@router.get("/{item_id}", response_model=AdminSettingOut)
def retrieve(item_id: int, db: Session = Depends(get_db)):
    """Одна услуга по id; 404 если нет."""
    item = get_admin_setting(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    return item


@router.delete("/{item_id}", status_code=204)
def remove(item_id: int, db: Session = Depends(get_db)):
    """Удалить услугу. 204 No Content — стандартный ответ для успешного DELETE без тела."""
    if not delete_admin_setting(db, item_id):
        raise HTTPException(status_code=404, detail="Setting not found")
    return None
