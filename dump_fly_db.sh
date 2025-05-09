#!/usr/bin/env bash
set -euo pipefail

FLY_APP="chatcommit"

echo "➤ SSHing into Fly app '$FLY_APP' and inspecting /data…"

fly ssh console -a "$FLY_APP" << 'EOF'
python3 << 'PY'
import os, sqlite3

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
PY
EOF

echo "➤ Done."
