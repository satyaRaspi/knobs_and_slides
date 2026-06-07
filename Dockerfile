# Knobs and Slides Studio 1.2.4
# Railway Docker build with explicit frontend dependency install.

FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy only frontend package metadata first for better Docker caching.
COPY frontend/package.json frontend/package-lock.json* ./

# Railway may set production install flags in the build environment.
# Force dev/build dependencies to be installed so vite is available.
RUN npm ci --include=dev || npm install --include=dev

COPY frontend/ ./

# Use npm exec so the local vite binary is resolved from node_modules.
RUN npm exec vite -- build

FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt ./backend/requirements.txt
RUN python -m pip install --upgrade pip && \
    python -m pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY server.py ./server.py
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
