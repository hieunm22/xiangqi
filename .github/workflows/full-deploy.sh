#!/usr/bin/env bash
#
# Predefined full-deploy script, executed on the server via SSH by the
# "Manual Deploy" GitHub Actions workflow (.github/workflows/manual-deploy.yml).
#
# DEPLOY_BRANCH        — target branch (passed via envs)
# INSTALL_DEPS         — "true" to run yarn install before make publish
# SERVER_IP            — Server IP address
# JWT_SECRET           — JWT secret
# GOOGLE_APP_PASSWORD  — Google app password
# GOOGLE_CLIENT_ID     — Google client ID
# FACEBOOK_APP_ID      — Facebook app ID
# AD_TAG_URL           — Ad tag URL
# FACEBOOK_APP_SECRET  — Facebook app secret
# REDIS_PASSWORD       — Redis password
# MONGO_PASSWORD       — MongoDB password
# AWS_ACCESS_ID        — AWS access ID
# AWS_SECRET_KEY       — AWS secret key
# TOOL_API_KEY         — Tool API key
# POSTGRES_PASSWORD    — Postgres password (used to build DATABASE_URL)

set -euo pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

BRANCH="${DEPLOY_BRANCH:-master}"

cd ~/projects/xiangqi

# Load config from GitHub Actions vars/secrets or .env.local fallback
load_config() {
  local var_name="$1"
  local var_value="${!var_name:-}"

  # Treat empty, null, or placeholder-like values as missing
  if [[ -z "$var_value" || "$var_value" == "null" || "$var_value" =~ ^\<.*\>$ ]]; then
    var_value=""
  fi

  if [ -z "$var_value" ] && [ -f ".env.local" ]; then
    var_value=$(grep "^${var_name}=" .env.local | cut -d= -f2- | tr -d '"' || true)
  fi

  export "$var_name=$var_value"
}

load_config "SERVER_IP"
load_config "JWT_SECRET"
load_config "GOOGLE_APP_PASSWORD"
load_config "GOOGLE_CLIENT_ID"
load_config "FACEBOOK_APP_ID"
load_config "AD_TAG_URL"
load_config "FACEBOOK_APP_SECRET"
load_config "REDIS_PASSWORD"
load_config "MONGO_PASSWORD"
load_config "AWS_ACCESS_ID"
load_config "AWS_SECRET_KEY"
load_config "TOOL_API_KEY"
load_config "POSTGRES_PASSWORD"

# Generate frontend/.env.local with VITE_ prefix
cat > frontend/.env.local << EOF
VITE_BACKEND_BASE_URL=https://xaa.hieunm.io.vn
VITE_PUBLIC_DISTRIBUTION=https://clf.hieunm.io.vn
VITE_FACEBOOK_APP_ID=$FACEBOOK_APP_ID
VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
VITE_AD_TAG_URL=$AD_TAG_URL
EOF

# Regenerate backend/.env.local only if it was removed
if [ ! -f backend/.env.local ]; then
  echo "backend/.env.local missing — regenerating from forwarded config"
  cat > backend/.env.local << EOF
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@${SERVER_IP}:5432/xiangqi
SERVER_IP=$SERVER_IP
JWT_SECRET=$JWT_SECRET
JWT_ISSUER=xaa.hieunm.io.vn
GOOGLE_APP_PASSWORD=$GOOGLE_APP_PASSWORD
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
FACEBOOK_APP_ID=$FACEBOOK_APP_ID
FACEBOOK_APP_SECRET=$FACEBOOK_APP_SECRET
REDIS_HOST=cache
REDIS_PASSWORD=$REDIS_PASSWORD
CORS_ORIGINS=http://localhost:3004,http://localhost:5001,http://localhost:8000,https://xaq.hieunm.io.vn,https://xaa.hieunm.io.vn
API_HOST=https://xaa.hieunm.io.vn
APP_EMAIL=hieuami@gmail.com
MONGODB_DB_NAME=xiangqi
MONGO_PASSWORD=$MONGO_PASSWORD
FAIRY_STOCKFISH_PATH=/usr/local/bin/fairy-stockfish
AWS_ACCESS_ID=$AWS_ACCESS_ID
AWS_SECRET_KEY=$AWS_SECRET_KEY
AMOUNT_RECONCILE_AUTOFIX=true
TOOL_API_KEY=$TOOL_API_KEY
EOF
fi

echo "=== Full deploy, branch: $BRANCH ==="

git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "--- Deploying backend ---"
cd backend

if [ "${INSTALL_DEPS:-false}" = "true" ]; then
  echo "Installing dependencies..."
  yarn install
fi

make publish
cd ..

echo "--- Deploying frontend ---"
cd frontend

if [ "${INSTALL_DEPS:-false}" = "true" ]; then
  echo "Installing dependencies..."
  yarn install
fi

make publish
cd ..

echo "=== Deployment completed ==="
