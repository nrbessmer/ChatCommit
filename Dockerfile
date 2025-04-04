# Base Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy backend requirements and install
COPY pyproject.toml ./
RUN python -m venv .venv && .venv/bin/pip install .

# Copy backend source code
COPY . ./

# Copy prebuilt frontend files (run `npm run build` first!)
COPY frontend/.next/ ./frontend/.next/
COPY frontend/public/ ./frontend/public/

# Expose FastAPI port
EXPOSE 8000

# Run FastAPI app via Uvicorn
CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
