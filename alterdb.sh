#!/usr/bin/env bash
set -euo pipefail

FLY_APP="chatcommit"

echo "➤ SSHing into Fly app '$FLY_APP' and inspecting /data…"

fly ssh console -a "$FLY_APP" << 'EOF'
python3 << 'PY'
import os, sqlite3, sys

DB_CANDIDATES = ["/data/dev.db", "/data/chatcommit.db"]

print("🔍 Remote working dir:", os.getcwd())
try:
    print("🔍 /data contains:", os.listdir("/data"))
except Exception as e:
    print("⚠️  Could not list /data:", e)

for db_path in DB_CANDIDATES:
    print(f"\n==== Inspecting {db_path} ====")
    print(" • exists:", os.path.exists(db_path))
    if not os.path.exists(db_path):
        continue
    try:
        st = os.stat(db_path)
        print(" • stat:", f"mode={oct(st.st_mode)} size={st.st_size}")
    except Exception as e:
        print(" • stat error:", e)
    try:
        conn = sqlite3.connect(db_path)
        cur  = conn.cursor()
        tables = [r[0] for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
        ).fetchall()]
        if not tables:
            print("  (no tables)")
        else:
            for t in tables:
                print(f"\n-- {t} (up to 5 rows) --")
                for row in conn.execute(f"SELECT * FROM {t} LIMIT 5;"):
                    print("   ", row)
        conn.close()
    except Exception as e:
        print(" ❌ error opening/reading:", e)

# Now perform the ALTER on the real DB
REAL_DB = "/data/chatcommit.db"
print(f"\n➤ Running schema update on {REAL_DB}…")
if not os.path.exists(REAL_DB):
    print(f"❌ {REAL_DB} not found, skipping ALTER.")
    sys.exit(0)

conn = sqlite3.connect(REAL_DB)
cur = conn.cursor()

# 1) disable FK enforcement
cur.execute("PRAGMA foreign_keys = OFF;")

# 2) add owner_id to branches
try:
    cur.execute("ALTER TABLE branches ADD COLUMN owner_id INTEGER;")
    print("✅ Added owner_id column to branches.")
except sqlite3.OperationalError as e:
    print("⚠️  ALTER skipped (probably already exists):", e)

# 3) create an index
cur.execute("CREATE INDEX IF NOT EXISTS ix_branches_owner_id ON branches(owner_id);")
print("✅ Ensured ix_branches_owner_id exists.")

# 4) re-enable FK enforcement
cur.execute("PRAGMA foreign_keys = ON;")

conn.commit()
conn.close()
print("✅ Schema update complete.")
PY
EOF

echo "➤ Done. Don’t forget to restart your app:"
echo "    fly apps restart $FLY_APP"

