#!/usr/bin/env bash
set -e  # exit on first error

# ───── CONFIG ────────────────────────────────────────────────────────────────
APP_NAME="chatcommit"      # currently unused – but handy if you need it
FRONTEND_DIR="frontend"
BACKEND_DIR="."
VERCEL_PROJECT="chatcommit" # update if your Vercel project differs
FLY_APP="chatcommit"        # your Fly.io app name

# ───── STEP 1: PUSH TO GIT ───────────────────────────────────────────────────
echo "📦  Committing and pushing code to Git…"
git add .
git commit -m "🔄 Update and deploy latest changes" || echo "ℹ️  Nothing to commit."
git push origin main

# ───── STEP 2: DEPLOY BACKEND (Fly.io) ───────────────────────────────────────
echo "🌍  Deploying backend to Fly.io…"
(
  cd "$BACKEND_DIR"
  # --detach → don’t wait for health‑checks; run in a subshell (&) so we can continue
  fly deploy --app "$FLY_APP" --detach
)

# ───── STEP 3: BUILD FRONTEND ────────────────────────────────────────────────
echo "🔧  Building frontend with Yarn…"
cd "$FRONTEND_DIR"
yarn install --frozen-lockfile
yarn build

# ───── STEP 4: DEPLOY FRONTEND (Vercel) ──────────────────────────────────────
echo "🚀  Deploying frontend to Vercel…"
vercel --prod --confirm --scope "$VERCEL_PROJECT"

echo "✅  Deployment pipeline completed successfully!"
