FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml ./
RUN python -m venv .venv && .venv/bin/pip install .

COPY . ./

# Copy Next.js production build
COPY app/frontend/.next/ ./frontend/.next/

EXPOSE 8000

CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

