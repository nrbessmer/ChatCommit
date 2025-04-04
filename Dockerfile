# ------------ STAGE 1: Build Frontend ------------
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

COPY frontend ./
RUN npm run build

# ------------ STAGE 2: Backend + Static Bundle ------------
FROM python:3.11-slim AS final

WORKDIR /app

# Python dependencies
COPY pyproject.toml ./
RUN python -m venv .venv && .venv/bin/pip install .

# Copy backend source
COPY . ./

# Copy frontend build artifacts from stage 1
COPY --from=frontend-build /frontend/.next /app/frontend/.next
COPY --from=frontend-build /frontend/public /app/frontend/public
COPY --from=frontend-build /frontend/app /app/frontend/app

# Expose FastAPI port
EXPOSE 8000

# Launch FastAPI app
CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
