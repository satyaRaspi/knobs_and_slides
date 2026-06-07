# Knobs and Slides Studio 1.2.8
# Railway Docker build hardened for React/Vite dependencies.

FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy only package.json first. Do NOT copy package-lock.json here because
# generated lock files can contain environment-specific registry URLs.
COPY frontend/package.json ./package.json

# Install both production and dev/build dependencies from the public npm registry.
# React must be in local node_modules before Vite builds the app.
RUN npm config set registry https://registry.npmjs.org/ && \
    npm install --include=dev --no-audit --no-fund --legacy-peer-deps --registry=https://registry.npmjs.org/ && \
    test -d node_modules/react && \
    test -d node_modules/react-dom && \
    test -x node_modules/.bin/vite

COPY frontend/ ./

# Use the local Vite binary only. This avoids npm/npx downloading a temporary
# Vite version that cannot see the project's local React dependencies.
RUN ./node_modules/.bin/vite build

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
