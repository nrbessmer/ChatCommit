FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml ./
RUN python -m venv .venv && .venv/bin/pip install .

COPY . ./

EXPOSE 8000

CMD ["/app/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
