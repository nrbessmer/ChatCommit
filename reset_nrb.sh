#!/usr/bin/env bash
set -euo pipefail

APP=${1:-chatcommit}
DB_PATH=${2:-/data/chatcommit.db}

echo "🔍 Connecting to Fly app '$APP' to clear $DB_PATH …"

fly ssh console -a "$APP" <<EOF
python3 - <<PY
import sqlite3, os, sys

db = "$DB_PATH"
if not os.path.exists(db):
    print(f"❌ Database not found at {db}")
    sys.exit(1)

conn = sqlite3.connect(db)
c = conn.cursor()

# Turn off FK enforcement
c.execute("PRAGMA foreign_keys = OFF;")

# Truncate each user table
for tbl in ["commits", "branches", "tags", "users"]:
    try:
        c.execute(f"DELETE FROM {tbl};")
    except sqlite3.OperationalError as e:
        print(f"⚠️ Couldn't delete from {tbl}: {e}")

# Reset autoincrement counters
try:
    c.execute("DELETE FROM sqlite_sequence;")
except sqlite3.OperationalError:
    pass

conn.commit()

# Print row counts
print("📊 Row counts after clear:")
for tbl in ["commits", "branches", "tags", "users"]:
    try:
        cnt = c.execute(f"SELECT COUNT(*) FROM {tbl};").fetchone()[0]
        print(f" - {tbl}: {cnt}")
    except sqlite3.OperationalError:
        print(f" - {tbl}: (table not found)")

conn.close()
print("✅ All tables cleared. Don’t forget to restart your app:")
print("    fly apps restart $APP")
PY
EOF
