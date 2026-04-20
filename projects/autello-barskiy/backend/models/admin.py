"""Администраторы — отдельная таблица для JWT-авторизации панели.

В открытом виде пароль не хранится никогда: при регистрации сразу
получаем bcrypt-хеш и кладём его в password_hash.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.orm import Session

from core.database import Base
from core.security import hash_password


class Admin(Base):
    """
    CREATE TABLE admins (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT now()
    );
    """

    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    # UNIQUE на уровне БД — даже если сверху не проверим, второй INSERT
    # с тем же username упадёт с IntegrityError, а не создаст дубль.
    username = Column(String(64), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# --- Pydantic-схемы ----------------------------------------------------------

class AdminCreate(BaseModel):
    """Вход для POST /api/auth/register.

    min_length=3/8 — простая защита «от дурака», не полноценная парольная политика.
    """
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class AdminOut(BaseModel):
    """Ответ API. password_hash наружу не отдаётся принципиально —
    он не нужен клиенту и любое логирование этого поля — потенциальная утечка."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    created_at: datetime


class TokenOut(BaseModel):
    """Ответ на успешный логин: сам JWT и схема для заголовка Authorization."""
    access_token: str
    token_type: str = "bearer"


class HasAdminsOut(BaseModel):
    """Ответ публичного /api/auth/check — фронт решает, показывать ли кнопку регистрации."""
    has_admins: bool


# --- CRUD --------------------------------------------------------------------

def count_admins(db: Session) -> int:
    """Сколько админов всего — нужно и /check, и логике «регистрация только первого»."""
    return db.query(Admin).count()


def get_admin_by_username(db: Session, username: str) -> Admin | None:
    """Найти админа по логину; None — если нет."""
    return db.query(Admin).filter(Admin.username == username).first()


def create_admin(db: Session, data: AdminCreate) -> Admin:
    """Создать админа: хешируем пароль перед сохранением, сам пароль нигде не остаётся."""
    admin = Admin(
        username=data.username,
        password_hash=hash_password(data.password),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin
