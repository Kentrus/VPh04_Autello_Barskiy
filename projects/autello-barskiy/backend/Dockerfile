# Backend-образ: FastAPI-приложение на Python 3.12.
# Собирается локально, пушится в registry.otiva.ru, оттуда подхватывается Watchtower.

FROM python:3.12-slim

# PYTHONDONTWRITEBYTECODE — не создавать .pyc (экономит место в слоях)
# PYTHONUNBUFFERED — сразу писать stdout/stderr без буферизации, чтобы docker logs были в реалтайме
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# requirements.txt копируем отдельно от кода — при изменении кода
# не пересобирается слой с `pip install`, сборка ускоряется.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
