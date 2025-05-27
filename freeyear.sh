#!/usr/bin/env bash
set -euo pipefail

APP="chatcommit"
DB_PATH="/data/chatcommit.db"

fly ssh console -a "$APP" --command "bash -lc \"python3 << 'PYCODE'
import sqlite3

# 1) open DB
conn = sqlite3.connect('$DB_PATH')
cur  = conn.cursor()

# 2) fetch first 500 users
users = cur.execute(
    'SELECT id, full_name, email FROM users ORDER BY id LIMIT 500'
).fetchall()

# 3) display them
print('=== First 500 users ===')
for uid, name, email in users:
    print(f'{uid}\\t{name}\\t{email}')

# 4) mark subscribed=1
cur.executemany(
    'UPDATE users SET subscribed = 1 WHERE id = ?',
    [(uid,) for uid,_,_ in users]
)
conn.commit()
print('\\n✅ Updated subscribed flag for first 500 users\\n')

# 5) generate form letters
print('=== Form letters ===')
for uid, name, email in users:
    print('---')
    print(f'To: {email}')
    print('Subject: Your one-year free subscription to ChatCommit')
    print()
    print(f'Hello {name},\\n')
    print('Thank you for being one of our first 500 users! As a token of our appreciation,')
    print('we are delighted to grant you a complimentary one-year subscription to ChatCommit.')
    print()
    print('Enjoy all premium features at no cost for the next twelve months.')
    print()
    print('If you have any questions, please reach out to us at info@tullyedmvibe.com.')
    print()
    print('Best regards,')
    print('The ChatCommit Team')
    print('---\\n')

conn.close()
PYCODE\""
