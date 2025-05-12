#!/usr/bin/env bash
set -euo pipefail

# ——————————————————————————————————————
# SSH into Fly app “chatcommit” and list FastAPI routes
# ——————————————————————————————————————
APP_NAME="chatcommit"
REMOTE_APP_DIR="${1:-/app}"

fly ssh console -a "$APP_NAME" << 'SSH_EOF'
cd "$REMOTE_APP_DIR"
python3 - << 'PY_EOF'
import sys

# adjust this if your FastAPI app isn’t in app.main
try:
    from app.main import app
except ImportError:
    print("❗️ Could not import FastAPI app from app.main; check module path.", file=sys.stderr)
    sys.exit(1)

print(f"Routes for {app.title if hasattr(app, 'title') else 'chatcommit'}\n")
for route in app.routes:
    methods = ','.join(sorted(route.methods or []))
    print(f"{route.name:30s} {route.path:30s} [{methods}]")
PY_EOF
SSH_EOF

