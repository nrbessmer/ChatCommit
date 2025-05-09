#!/usr/bin/env bash
set -euo pipefail

# Fly app name (defaults to “chatcommit” if you don’t pass one)
APP=${1:-chatcommit}

fly ssh console -a "$APP" --command "
  echo '🚮 Removing old SQLite files…'
  rm -f /data/chatcommit.db /data/dev.db

  echo '🛠  Creating schema and default branch…'
  python3 - << 'PYCODE'
from app.database import engine, Base
from app.main import initialize_default_branch

# 1) Create all tables
Base.metadata.create_all(bind=engine)
# 2) Initialize the default branch & init commit
initialize_default_branch()

print('✅ Reset complete.')
PYCODE
"
