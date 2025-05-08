#!/usr/bin/env bash
# db_inspect.sh

python3 - << 'PYCODE'
import os, sqlite3

# Walk entire filesystem looking for *.db
db_files = []
for root, dirs, files in os.walk('/'):
    for f in files:
        if f.endswith('.db'):
            db_files.append(os.path.join(root, f))

if not db_files:
    print("❌ No .db files found!")
    exit(1)

print("Found DB files:")
for db in db_files:
    print("  ", db)
print()

# For each, print its tables
for db in db_files:
    print(f"=== Inspecting {db} ===")
    try:
        conn = sqlite3.connect(db)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [r[0] for r in cur.fetchall()]
        if not tables:
            print("  (no tables)")
        else:
            print("  Tables:", ", ".join(tables))
            # show 5 rows from each
            for tbl in tables:
                print(f"\n  -- {tbl} (up to 5 rows) --")
                cur.execute(f"PRAGMA table_info({tbl});")
                cols = [c[1] for c in cur.fetchall()]
                cur.execute(f"SELECT * FROM {tbl} LIMIT 5;")
                rows = cur.fetchall()
                if not rows:
                    print("     (no rows)")
                else:
                    # pretty‑print
                    widths = [max(len(str(v)) for v in [cols[i]] + [row[i] for row in rows])
                              for i in range(len(cols))]
                    hdr = " | ".join(cols[i].ljust(widths[i]) for i in range(len(cols)))
                    print("     "+hdr)
                    print("     "+("-+-".join("-"*w for w in widths)))
                    for row in rows:
                        print("     "+" | ".join(str(row[i]).ljust(widths[i]) for i in range(len(cols))))
    except Exception as e:
        print("  Error opening", db, ":", e)
    finally:
        try: conn.close()
        except: pass
    print()

PYCODE

