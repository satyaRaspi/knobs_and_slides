# Knobs and Slides Studio 1.2.15
# Railway Docker build with safer runtime startup.

FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json ./package.json

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
COPY start_railway.sh ./start_railway.sh
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/data && chmod +x /app/start_railway.sh

EXPOSE 8000

CMD ["/app/start_railway.sh"]
