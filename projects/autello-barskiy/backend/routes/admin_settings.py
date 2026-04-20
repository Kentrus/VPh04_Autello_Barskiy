"""HTTP-эндпоинты для каталога услуг.

GET /admin-settings — публичный, фронт главной страницы дёргает при
загрузке, чтобы наполнить выпадашку услуг.
POST / PUT / DELETE — под JWT-авторизацией (VPh06): только залогиненный
админ может менять каталог.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models.admin import Admin
from models.admin_setting import (
    AdminSettingCreate,
    AdminSettingOut,
    AdminSettingUpdate,
    create_admin_setting,
    delete_admin_setting,
    get_admin_setting,
    get_admin_settings,
    update_admin_setting,
)
from routes.auth import get_current_admin

router = APIRouter(prefix="/admin-settings", tags=["admin-settings"])


@router.get("", response_model=list[AdminSettingOut])
def list_all(db: Session = Depends(get_db)):
    """Все услуги каталога — фронт строит из этого выпадающий список.
    Публичный: любой посетитель сайта должен видеть, какие услуги предлагаются."""
    return get_admin_settings(db)


@router.get("/{item_id}", response_model=AdminSettingOut)
def retrieve(item_id: int, db: Session = Depends(get_db)):
    """Одна услуга по id; 404 если нет."""
    item = get_admin_setting(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    return item


# --- Мутации: только под авторизацией ---------------------------------------

@router.post("", response_model=AdminSettingOut, status_code=201)
def create(
    data: AdminSettingCreate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """Добавить услугу в каталог. Требуется валидный JWT админа."""
    return create_admin_setting(db, data)


@router.put("/{item_id}", response_model=AdminSettingOut)
def update(
    item_id: int,
    data: AdminSettingUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """Изменить услугу (используется inline-редактированием в таблице админки)."""
    item = update_admin_setting(db, item_id, data)
    if item is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    return item


@router.delete("/{item_id}", status_code=204)
def remove(
    item_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    """Удалить услугу. 204 No Content — стандартный ответ для успешного DELETE без тела."""
    if not delete_admin_setting(db, item_id):
        raise HTTPException(status_code=404, detail="Setting not found")
    return None
