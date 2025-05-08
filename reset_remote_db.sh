#!/usr/bin/env bash
set -euo pipefail

APP=${1:-chatcommit}
DB_PATH=${2:-/data/chatcommit.db}

fly ssh console -a "$APP" --command "
  echo '🚮 Deleting $DB_PATH'
  rm -f $DB_PATH

  echo '🛠  Recreating schema...'
  python3 - << 'PYCODE'
from app.database import engine, Base
Base.metadata.create_all(bind=engine)
print('✅ Schema created.')
PYCODE
"

