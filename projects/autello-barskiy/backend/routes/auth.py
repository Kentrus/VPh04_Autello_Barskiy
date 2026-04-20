"""HTTP-эндпоинты авторизации админ-панели.

Поток:
  1. Фронт при загрузке /admin дёргает GET /api/auth/check —
     если админов ещё нет, показывает кнопку «Зарегистрироваться».
  2. POST /api/auth/register доступен только пока админов ноль
     (защита от подмены админа снаружи после первой регистрации).
  3. POST /api/auth/login выдаёт JWT — фронт хранит его в localStorage
     и подставляет в заголовок `Authorization: Bearer ...` к защищённым
     эндпоинтам.
  4. GET /api/auth/me — «кто я» — используется фронтом для проверки,
     что сохранённый токен ещё валиден (иначе — редирект на логин).

`get_current_admin` — dependency, которую подключают к эндпоинтам,
требующим авторизации (см. routes/admin_settings.py).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import jwt

from core.database import get_db
from core.security import create_access_token, decode_access_token, verify_password
from models.admin import (
    Admin,
    AdminCreate,
    AdminOut,
    HasAdminsOut,
    TokenOut,
    count_admins,
    create_admin,
    get_admin_by_username,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# tokenUrl здесь нужен только Swagger UI — там появится кнопка «Authorize»,
# которая под капотом дёрнет /api/auth/login и сохранит токен.
# Для самого приложения тут важно одно: этот объект умеет вытаскивать
# токен из заголовка Authorization: Bearer <token>.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# --- Dependency: текущий админ ----------------------------------------------

def get_current_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Admin:
    """Привратник для защищённых эндпоинтов.

    1. FastAPI достаёт токен из Authorization-заголовка (через oauth2_scheme).
    2. Мы декодируем и проверяем подпись + срок (decode_access_token).
    3. Находим админа в БД (токен мог быть валидным, но админа уже удалили).
    Любая проблема → 401 с пустым `WWW-Authenticate: Bearer` (так велит RFC).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    admin = get_admin_by_username(db, username)
    if admin is None:
        raise credentials_exception
    return admin


# --- Эндпоинты ---------------------------------------------------------------

@router.get("/check", response_model=HasAdminsOut)
def check_admins_exist(db: Session = Depends(get_db)):
    """Публично: есть ли уже хотя бы один админ.

    Фронт на основании этого решает, показывать ли форму регистрации
    на странице /admin. Сами данные админов не раскрываются.
    """
    return HasAdminsOut(has_admins=count_admins(db) > 0)


@router.post("/register", response_model=AdminOut, status_code=201)
def register(data: AdminCreate, db: Session = Depends(get_db)):
    """Регистрация первого админа. После этого endpoint закрывается.

    Почему не требуем авторизации для первого админа: иначе замкнутая
    ситуация — зарегистрироваться нельзя без токена, а получить токен
    нельзя без регистрации. Для последующих админов регистрация делается
    руками через БД (или добавим отдельный защищённый endpoint позже).
    """
    if count_admins(db) > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is closed: an admin already exists",
        )

    try:
        return create_admin(db, data)
    except IntegrityError:
        # Теоретически невозможно (count_admins == 0), но оставляем на случай
        # гонки двух одновременных регистраций.
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already taken")


@router.post("/login", response_model=TokenOut)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Проверяем логин/пароль и выдаём JWT.

    Принимаем application/x-www-form-urlencoded (поля username, password) —
    это стандарт OAuth2 Password Flow. Преимущество: кнопка Authorize в
    Swagger UI работает «из коробки», фронту тоже не сложнее — URLSearchParams.

    Сообщение об ошибке одинаковое и для «такого логина нет», и для «пароль
    не подошёл» — чтобы перебор не мог по ответу выяснить, какие логины
    существуют в системе.
    """
    admin = get_admin_by_username(db, form.username)
    if admin is None or not verify_password(form.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=admin.username)
    return TokenOut(access_token=token)


@router.get("/me", response_model=AdminOut)
def me(current: Admin = Depends(get_current_admin)):
    """«Кто я» — фронт дёргает после старта, чтобы понять, валиден ли сохранённый токен."""
    return current
