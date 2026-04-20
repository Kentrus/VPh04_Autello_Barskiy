"""Настройки приложения из переменных окружения.

Значения читаются один раз при старте через pydantic-settings.
Если какой-то переменной нет в окружении — падаем сразу с понятной ошибкой,
а не получаем None где-то в глубине SQLAlchemy.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    POSTGRES_HOST: str
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    # JWT-настройки. SECRET_KEY обязателен — сгенерировать локально: openssl rand -hex 32.
    # Если ключ утечёт, злоумышленник сможет подписывать токены от имени админа,
    # поэтому он никогда не коммитится в репо — живёт в .env.
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    # Срок жизни токена в минутах. 24 часа — разумный компромисс для админки:
    # не слишком часто перелогиниваться, но не вечно висеть в браузере после закрытия.
    JWT_TTL_MINUTES: int = 60 * 24

    @property
    def database_url(self) -> str:
        """Строка подключения в формате SQLAlchemy: диалект+драйвер://user:pass@host:port/db."""
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
