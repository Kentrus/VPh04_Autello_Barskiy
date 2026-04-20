"""Криптография для админ-авторизации.

Две независимые задачи:
  * bcrypt — односторонний хеш паролей. В БД лежит хеш (с встроенной солью),
    сам пароль мы не храним и обратно не получим. При логине хешируем
    введённое и сравниваем с тем, что в БД.
  * JWT (JSON Web Token) — подписанный токен, в котором лежит `sub`
    (логин админа) и `exp` (момент истечения). Сервер никакого состояния
    по токенам не хранит; доверие даёт подпись SECRET_KEY.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from core.config import settings


# --- Пароли ------------------------------------------------------------------

def hash_password(raw: str) -> str:
    """Сгенерировать bcrypt-хеш из пароля в открытом виде.

    bcrypt.gensalt() сам создаёт случайную соль и вшивает её внутрь хеша.
    Поэтому один и тот же пароль при повторных вызовах даёт разные хеши —
    это и нужно: в БД не видно совпадений «у двух юзеров одинаковый пароль».
    """
    # bcrypt работает с bytes, поэтому кодируем/декодируем по краям.
    hashed = bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    """Проверить, что открытый пароль соответствует сохранённому хешу.

    bcrypt.checkpw достаёт соль прямо из `hashed` и заново хеширует `raw`
    с ней же — затем сравнивает. Операция constant-time, то есть время
    выполнения не зависит от того, где именно пароль разошёлся с хешем
    (защита от timing-атак).
    """
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # Невалидный формат хеша в БД — трактуем как «не совпало», а не падаем 500.
        return False


# --- JWT ---------------------------------------------------------------------

def create_access_token(subject: str) -> str:
    """Выпустить подписанный JWT со сроком жизни JWT_TTL_MINUTES.

    `sub` (subject) — стандартное поле JWT, кладём туда username админа.
    `exp` — момент истечения в Unix-времени; pyjwt при decode сам сверяет
    его с текущим временем и бросает ExpiredSignatureError, если просрочен.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "exp": now + timedelta(minutes=settings.JWT_TTL_MINUTES),
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Проверить подпись и срок, вернуть payload.

    Бросает jwt.PyJWTError (ExpiredSignatureError / InvalidTokenError / …)
    при любой проблеме — вызов выше ловит и превращает в HTTP 401.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
