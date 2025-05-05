#!/bin/bash

# ==== CONFIGURATION ====
APP_NAME="chatcommit"
FRONTEND_DIR="frontend"
BACKEND_DIR="."
VERCEL_PROJECT="chatcommit"  # Replace with your Vercel project name
FLY_APP="chatcommit"         # Replace with your Fly.io app name

# ==== STEP 1: GIT PUSH ====
echo "📦 Committing and pushing code to Git..."
git add .
git commit -m "🔄 Update and deploy latest changes"
git push origin main || { echo "❌ Git push failed."; exit 1; }

#Step 2 deploy t fly
echo "🌍 Deploying backend to Fly.io..."
cd "$BACKEND_DIR" || { echo "❌ Backend directory not found."; exit 1; }

fly deploy --app '${FLY_APP}' --detach || { echo "❌ Fly.io deployment failed."; exit 1; }

# ==== STEP 3: BUILD FRONTEND ====
echo "🔧 Building frontend with yarn..."
cd "$FRONTEND_DIR" || { echo "❌ Frontend directory not found."; exit 1; }

yarn install
yarn build || { echo "❌ Frontend build failed."; exit 1; }

# ==== STEP 4: DEPLOY TO VERCEL ====
echo "🚀 Deploying frontend to Vercel..."
vercel --prod --confirm || { echo "❌ Vercel deployment failed."; exit 1; }
cd ..

# ==== DONE ====
echo "✅ Deployment completed successfully!"

