#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh [commit-message]
# If a commit message is provided as the first argument, it will be used;
# otherwise, a default message is applied.
COMMIT_MSG="${1:-🔄 Update and deploy latest changes}"

# ==== CONFIGURATION ====
FRONTEND_DIR="frontend"
BACKEND_DIR="."
FLY_APP="chatcommit"
VERCEL_SCOPE="nicholas-bessmers-projects"  # ← your Vercel scope

# ==== STEP 1: COMMIT & PUSH ====
echo "📦  Committing and pushing code…"
echo "    ↳ commit message: $COMMIT_MSG"
git add .
git commit -m "$COMMIT_MSG" || true
git push origin main

# ==== STEP 2: DEPLOY BACKEND TO FLY.IO ====
echo "🌍  Deploying backend to Fly.io (detached)…"
cd "$BACKEND_DIR"
fly deploy --app "$FLY_APP" --detach

# ==== STEP 3: BUILD FRONTEND ====
echo "🔧  Building frontend…"
cd "$FRONTEND_DIR"
yarn install --frozen-lockfile
yarn build

# ==== STEP 4: LINK PROJECT TO VERCEL (once) ====
if [ ! -f ".vercel/project.json" ]; then
  echo "🔗  Linking to Vercel scope ‘$VERCEL_SCOPE’…"
  vercel link --scope "$VERCEL_SCOPE" --yes
fi

# ==== STEP 5: DEPLOY FRONTEND TO VERCEL ====
echo "🚀  Deploying frontend to Vercel…"
vercel deploy --prod --confirm --scope "$VERCEL_SCOPE"

# ==== DONE ====
echo "✅  All done! Backend on Fly → https://$FLY_APP.fly.dev/  •  Frontend on Vercel → https://$VERCEL_SCOPE.vercel.app/"
