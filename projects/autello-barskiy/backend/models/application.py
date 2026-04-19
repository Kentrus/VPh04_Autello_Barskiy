from datetime import datetime

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Session

from core.database import Base


class Application(Base):
    """
    Заявка от клиента — основная таблица проекта.

    CREATE TABLE applications (
        id               SERIAL PRIMARY KEY,
        last_name        VARCHAR(100) NOT NULL,
        first_name       VARCHAR(100) NOT NULL,
        middle_name      VARCHAR(100),
        business_niche   VARCHAR(255),
        company_size     VARCHAR(100),
        task_scope       VARCHAR(255),
        role             VARCHAR(100),
        budget           VARCHAR(50),
        service          VARCHAR(255),
        deadline         VARCHAR(100),
        preferred_contact VARCHAR(100),
        contact_time     VARCHAR(100),
        comment          TEXT,
        created_at       TIMESTAMPTZ DEFAULT now(),
        updated_at       TIMESTAMPTZ DEFAULT now()
    );
    """

    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    last_name = Column(String(100), nullable=False)
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)

    business_niche = Column(String(255), nullable=True)
    company_size = Column(String(100), nullable=True)
    task_scope = Column(String(255), nullable=True)
    role = Column(String(100), nullable=True)

    budget = Column(String(50), nullable=True)
    service = Column(String(255), nullable=True)
    deadline = Column(String(100), nullable=True)

    preferred_contact = Column(String(100), nullable=True)
    contact_time = Column(String(100), nullable=True)
    comment = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ApplicationCreate(BaseModel):
    last_name: str
    first_name: str
    middle_name: str | None = None
    business_niche: str | None = None
    company_size: str | None = None
    task_scope: str | None = None
    role: str | None = None
    budget: str | None = None
    service: str | None = None
    deadline: str | None = None
    preferred_contact: str | None = None
    contact_time: str | None = None
    comment: str | None = None


class ApplicationOut(ApplicationCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


def create_application(db: Session, data: ApplicationCreate) -> Application:
    app = Application(**data.model_dump())
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


def get_applications(db: Session, skip: int = 0, limit: int = 100) -> list[Application]:
    return db.query(Application).order_by(Application.id.desc()).offset(skip).limit(limit).all()


def get_application(db: Session, app_id: int) -> Application | None:
    return db.query(Application).filter(Application.id == app_id).first()
