#!/usr/bin/env bash
###############################################################################
#  ChatCommit one‑shot deploy
#  - pushes current branch to origin/main
#  - builds & deploys *frontend* -> Vercel
#  - deploys *backend*  -> Fly.io
#  Both deploys happen in parallel; the script exits non‑zero if either fails.
###############################################################################
set -e          # fail fast for commands we *don’t* run in parallel
set -o pipefail

# ───────── Configuration ────────────────────────────────────────────────────
APP_NAME="chatcommit"            # purely informational
FRONTEND_DIR="frontend"
BACKEND_DIR="."                  # repo root (contains fly.toml / Dockerfile)
VERCEL_FLAGS="--prod --confirm"  # adjust to taste
FLY_APP="chatcommit"             # fly.io app name
###############################################################################

echo "📦 1. Git push → origin/main"
git add .
git commit -m "🔄 Update and deploy latest changes" || true   # no‑op if nothing to commit
git push origin main

# ───────── Helper to run a step in a subshell and capture its exit status ───
run_bg () {
  ( eval "$1" ) &
  echo $!            # return PID
}

# ───────── 2. Frontend build + Vercel deploy (background) ───────────────────
echo "🚀 2A. Launching Vercel pipeline in background…"
frontend_pipeline="
  set -e
  echo '  ↪️  Installing & building frontend…'
  cd '${FRONTEND_DIR}'
  yarn install --silent
  yarn build
  echo '  ↪️  Deploying to Vercel…'
  vercel ${VERCEL_FLAGS}
"
pid_front=$(run_bg "${frontend_pipeline}")

# ───────── 3. Fly.io deploy (background) ────────────────────────────────────
echo "🌍 2B. Launching Fly.io pipeline in background…"
backend_pipeline="
  set -e
  echo '  ↪️  Deploying backend to Fly.io…'
  cd '${BACKEND_DIR}'
  fly deploy --app '${FLY_APP}'
"
pid_back=$(run_bg "${backend_pipeline}")

# ───────── 4. Wait for both pipelines and check exit codes ──────────────────
echo "⏳ 3. Waiting for both deploys to finish…"
wait ${pid_front}
status_front=$?
wait ${pid_back}
status_back=$?

# ───────── 5. Final status ──────────────────────────────────────────────────
if [[ ${status_front} -ne 0 || ${status_back} -ne 0 ]]; then
  echo "❌ Deployment failed."
  echo "   Vercel exit code : ${status_front}"
  echo "   Fly.io exit code : ${status_back}"
  exit 1
fi

echo "✅ Both Vercel and Fly.io deployments completed successfully!"
