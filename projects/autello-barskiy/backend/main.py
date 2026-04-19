from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.database import Base, engine
from routes import admin_settings, applications, behavior_metrics

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Autéllo Barskiy API",
    description="Backend для сайта обработки заявок премиум-автосервиса",
    version="0.1.1",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(applications.router)
app.include_router(admin_settings.router)
app.include_router(behavior_metrics.router)


@app.get("/health")
def health():
    return {"status": "ok"}
