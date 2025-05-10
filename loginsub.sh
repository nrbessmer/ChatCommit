#!/usr/bin/env bash
# login_and_subscribe.sh
set -euo pipefail

# ─── CONFIG ────────────────────────────────────────────
EMAIL="nrbessmer@gmail.com"
PASS="your_password_here"
PRICE_ID="price_1RN2R14gSRQ79MVCvdMCMw0K"
PM="pm_card_visa"

# ─── 1) Log in via the JSON shim (no subscription check) ─────
echo "🔑 Logging in via /users/login…"
RESPONSE=$(
  curl -s -X POST https://chatcommit.fly.dev/users/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}"
)
TOKEN=$(printf '%s' "$RESPONSE" | jq -r .access_token)

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "❌ Login failed. Response was:"
  echo "$RESPONSE"
  exit 1
fi
echo "🎟  Got token: $TOKEN"

# ─── 2) Create subscription ───────────────────────────────
echo "💳 Creating subscription…"
curl -i -X POST https://chatcommit.fly.dev/subscription/ \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"paymentMethodId\":\"${PM}\",\"planId\":\"${PRICE_ID}\"}"
echo
