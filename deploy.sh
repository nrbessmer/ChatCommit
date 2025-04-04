#!/bin/bash

set -e

echo "🧹 Cleaning old frontend build..."
rm -rf frontend/.next frontend/out app/frontend/build || true

echo "🔨 Building frontend..."
cd frontend
npm install --legacy-peer-deps
NEXT_DISABLE_ESLINT=true npm run build
cd ..

echo "📦 Copying frontend build into backend..."
mkdir -p app/frontend/build
cp -r frontend/.next app/frontend/build/
cp -r frontend/public app/frontend/build/
cp frontend/next.config.ts app/frontend/build/ || true

echo "🔃 Git check-in..."
git add .
read -p "Enter commit message: " commit_msg
git commit -m "$commit_msg" || echo "⚠️ Nothing to commit"
git push origin main

echo "🚀 Deploying to Fly.io..."
fly deploy
fly status
echo "✅ Deployment complete!"
echo "🌐 Visit your app: https://chatcommit.fly.dev/"

