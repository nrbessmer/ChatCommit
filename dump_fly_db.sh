#!/usr/bin/env python3
import os, sqlite3, sys

DB_CANDIDATES = ["/data/dev.db", "/data/chatcommit.db"]

print("🔍 Current working directory:", os.getcwd())
try:
    print("🔍 /data contains:", os.listdir("/data"))
except Exception as e:
    print("⚠️  Could not list /data:", e)

for db_path in DB_CANDIDATES:
    print(f"\n==== Inspecting {db_path} ====")
    print(" • exists:", os.path.exists(db_path))
    try:
        print(" • stat:", os.stat(db_path))
    except Exception as e:
        print(" • stat error:", e)

    if not os.path.exists(db_path):
        continue

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
                print(f"\n-- Table: {t} --")
                # print up to 5 rows
                rows = conn.execute(f"SELECT * FROM {t} LIMIT 5;").fetchall()
                if rows:
                    for row in rows:
                        print("   ", row)
                else:
                    print("   (no rows)")
        conn.close()
    except Exception as e:
        print(" ❌ error opening/reading:", e)
