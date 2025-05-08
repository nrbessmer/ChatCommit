# app/config.py

import os
from datetime import timedelta

# Read the same JWT_SECRET you set via flyctl
SECRET_KEY = os.getenv(
    "JWT_SECRET",
    "change‑this‑for‑dev‑only"   # fallback only for local dev
)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


