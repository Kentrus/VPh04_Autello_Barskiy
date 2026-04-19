# Frontend-образ: multi-stage.
# Stage 1 — собирает dist/ через webpack (нужен Node.js).
# Stage 2 — nginx раздаёт готовую статику. Node.js, node_modules в итоговый образ НЕ попадают.
# В результате образ ~20 МБ вместо ~400 МБ, если бы таскали всю сборочную среду.

# --- Stage 1: билд ---
FROM node:22-alpine AS builder
WORKDIR /app

# Сначала package*.json → npm ci → слой с зависимостями кешируется.
# Код меняется чаще — пересборка ускоряется.
COPY package*.json ./
# npm ci (а не install) — строгая установка из package-lock.json, повторяемый билд.
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: раздача ---
FROM nginx:1.27-alpine
# --from=builder — копируем только артефакт из первой стадии, всё остальное выкидывается.
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
