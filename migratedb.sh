#!/usr/bin/env bash
set -euo pipefail

FLY_APP="chatcommit"

echo "➤ SSHing into Fly app '$FLY_APP' to migrate branches table…"

fly ssh console -a "$FLY_APP" << 'EOF'
python3 << 'PY'
import sqlite3, os, textwrap

DB = "/data/chatcommit.db"
if not os.path.exists(DB):
    print("❌ DB not found at", DB)
    exit(1)

conn = sqlite3.connect(DB)
cur  = conn.cursor()

print("🔍 Old branches schema:")
old_schema = cur.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='branches';"
).fetchone()[0]
print(textwrap.indent(old_schema, "   "))

print("\n🔄 Beginning migration…")
cur.execute("PRAGMA foreign_keys = OFF;")
cur.execute("BEGIN TRANSACTION;")

# 1) Create new table with UNIQUE(name, owner_id)
cur.execute("""
CREATE TABLE branches_new (
    id                  INTEGER PRIMARY KEY,
    name                VARCHAR NOT NULL,
    current_commit_id   INTEGER,
    owner_id            INTEGER NOT NULL,
    UNIQUE(name, owner_id),
    FOREIGN KEY(current_commit_id) REFERENCES commits(id),
    FOREIGN KEY(owner_id)            REFERENCES users(id)
);
""")

# 2) Copy data across
cur.execute("""
INSERT INTO branches_new (id, name, current_commit_id, owner_id)
SELECT id, name, current_commit_id, owner_id FROM branches;
""")

# 3) Drop old and rename
cur.execute("DROP TABLE branches;")
cur.execute("ALTER TABLE branches_new RENAME TO branches;")

# 4) (Re)create an index on owner_id if you like
cur.execute("CREATE INDEX IF NOT EXISTS ix_branches_owner_id ON branches(owner_id);")

cur.execute("COMMIT;")
cur.execute("PRAGMA foreign_keys = ON;")
print("✅ Migration finished.")

print("\n🔍 New branches schema:")
new_schema = cur.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='branches';"
).fetchone()[0]
print(textwrap.indent(new_schema, "   "))

conn.close()
PY
EOF

echo "➤ Done."

