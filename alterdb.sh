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
    if not os.path.exists(db_path):
        print(" • exists: False")
        continue
    print(" • exists: True")
    try:
        st = os.stat(db_path)
        print(" • stat:", f"mode={oct(st.st_mode)} size={st.st_size}")
    except Exception as e:
        print(" • stat error:", e)

    try:
        conn = sqlite3.connect(db_path)
        cur  = conn.cursor()

        # list tables
        tables = [r[0] for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
        ).fetchall()]
        if not tables:
            print("  (no tables)")
        else:
            for t in tables:
                print(f"\n-- {t} schema --")
                # print DDL
                ddl = cur.execute(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name = ?",
                    (t,)
                ).fetchone()
                print("   ", ddl[0] if ddl else "(no DDL found)")

                print(f"\n-- {t} (up to 5 rows) --")
                for row in conn.execute(f"SELECT * FROM {t} LIMIT 5;"):
                    print("   ", row)
        conn.close()
    except Exception as e:
        print(" ❌ error opening/reading:", e)
PY

# Now perform ALTER on branches if needed
echo -e "\n➤ Running schema update on /data/chatcommit.db…"
# We’ll execute raw SQL via sqlite3 Python to ensure availability
python3 << 'PY'
import sqlite3, os, sys

db = "/data/chatcommit.db"
if not os.path.exists(db):
    print(f"❌ Database not found at {db}")
    sys.exit(1)

conn = sqlite3.connect(db)
c = conn.cursor()
# check if owner_id exists
cols = [row[1] for row in c.execute("PRAGMA table_info(branches);").fetchall()]
if "owner_id" in cols:
    print("✅ branches.owner_id already exists, skipping ALTER.")
else:
    print("🔧 Adding owner_id column to branches…")
    c.execute("PRAGMA foreign_keys = OFF;")
    c.execute("BEGIN TRANSACTION;")
    c.execute("ALTER TABLE branches ADD COLUMN owner_id INTEGER;")
    c.execute("CREATE INDEX IF NOT EXISTS ix_branches_owner_id ON branches(owner_id);")
    c.execute("PRAGMA foreign_keys = ON;")
    c.execute("COMMIT;")
    print("✅ Added owner_id column to branches.")

conn.close()
print("✅ Schema update complete.")
PY
EOF

echo "➤ Done."

