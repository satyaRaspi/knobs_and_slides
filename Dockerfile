# Knobs and Slides Studio 1.2.10
# Railway Docker build with robust Python startup.

FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy only package.json first. Do NOT rely on package-lock.json here because
# generated lock files can contain environment-specific registry URLs.
COPY frontend/package.json ./package.json

# Install frontend dependencies from public npm registry.
RUN npm config set registry https://registry.npmjs.org/ && \
    npm install --include=dev --no-audit --no-fund --legacy-peer-deps --registry=https://registry.npmjs.org/ && \
    test -d node_modules/react && \
    test -d node_modules/react-dom && \
    test -x node_modules/.bin/vite

COPY frontend/ ./
RUN ./node_modules/.bin/vite build

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV KNOBS_DB_PATH=/app/data/knobs_slides.db

COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --upgrade pip && \
    python -m pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY server.py ./server.py
COPY start.py ./start.py
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/data

EXPOSE 8000

# Use a Python startup script instead of shell $PORT expansion.
# This avoids Railway startCommand/env expansion problems.
CMD ["python", "start.py"]
