#!/usr/bin/env python3
import subprocess
import sys
import shlex

def build_remote_code(db_path: str) -> str:
    return f"""
import sqlite3, sys
db_path = '{db_path}'
try:
    conn = sqlite3.connect(db_path)
except Exception as e:
    print(f'❌ Could not open database at {{db_path}}: {{e}}', file=sys.stderr)
    sys.exit(1)

cursor = conn.cursor()
cursor.execute(\"\"\"SELECT name FROM sqlite_master
                  WHERE type='table' AND name NOT LIKE 'sqlite_%';\"\"\")
tables = [row[0] for row in cursor.fetchall()]
if not tables:
    print('No tables found.')
    sys.exit(0)

for table in tables:
    print(f\"\\n=== Table: {{table}} ===\")
    # column names
    cursor.execute(f\"PRAGMA table_info({{table}});\")
    cols = [col[1] for col in cursor.fetchall()]
    header = ' | '.join(cols)
    print(header)
    print('-' * len(header))
    # rows
    cursor.execute(f\"SELECT * FROM {{table}};\")
    for row in cursor.fetchall():
        print(' | '.join(str(item) for item in row))

conn.close()
"""

def main():
    if len(sys.argv) > 1:
        fly_app = sys.argv[1]
    else:
        fly_app = "chatcommit"
    db_path = "/data/chatcommit.db"

    remote_py = build_remote_code(db_path)
    # wrap in a here‑doc
    ssh_cmd = [
        "fly", "ssh", "console", "-a", fly_app,
        "--command",
        f"python3 - << 'PYCODE'\n{remote_py}\nPYCODE"
    ]

    print(f"🔍 Dumping '{db_path}' on Fly app '{fly_app}'...\n")
    try:
        subprocess.run(ssh_cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error running fly ssh: {e}", file=sys.stderr)
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()

