#!/usr/bin/env bash
set -euo pipefail

APP="${1:-chatcommit}"

cat << 'REMOTE' | fly ssh console -a "$APP" --command "bash -s"
#!/usr/bin/env bash
python3 - << 'PYCODE'
import sqlite3, glob, sys

db_files = glob.glob('/data/*.db')
if not db_files:
    print('❌ No .db files found under /data')
    sys.exit(1)

for db in db_files:
    print(f"\n=== Database: {db} ===")
    conn = sqlite3.connect(db)
    cur = conn.cursor()

    # get all table names
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [r[0] for r in cur.fetchall()]
    if not tables:
        print("  (no user tables found)")
        continue

    for tbl in tables:
        # count rows
        cur.execute(f"SELECT COUNT(*) FROM {tbl}")
        count = cur.fetchone()[0]
        print(f"\n-- Table: {tbl} ({count} rows) --")
        # fetch and print every row (you can pretty‑print with json.dumps if you like)
        for row in cur.execute(f"SELECT * FROM {tbl}"):
            print(row)

    conn.close()
print("\n✅ Done dumping all tables.")
PYCODE
REMOTE
