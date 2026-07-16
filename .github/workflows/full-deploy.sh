#!/usr/bin/env bash
#
# Predefined full-deploy script, executed on the server via SSH by the
# "Manual Deploy" GitHub Actions workflow (.github/workflows/manual-deploy.yml).
#
# DEPLOY_BRANCH        — target branch (passed via envs)
# INSTALL_DEPS         — "true" to run yarn install before make publish
# SERVER_IP            — Server IP address (from GitHub Actions vars or .env.local)
# JWT_SECRET           — JWT secret (from GitHub Actions secrets or .env.local)
# GOOGLE_APP_PASSWORD  — Google app password (from GitHub Actions secrets or .env.local)
# GOOGLE_CLIENT_ID     — Google client ID (from GitHub Actions vars or .env.local)
# FACEBOOK_APP_ID      — Facebook app ID (from GitHub Actions vars or .env.local)
# AD_TAG_URL           — Ad tag URL (from GitHub Actions vars or .env.local)
# FACEBOOK_APP_SECRET  — Facebook app secret (from GitHub Actions secrets or .env.local)
# REDIS_PASSWORD       — Redis password (from GitHub Actions secrets or .env.local)
# MONGO_PASSWORD       — MongoDB password (from GitHub Actions secrets or .env.local)
# AWS_ACCESS_ID        — AWS access ID (from GitHub Actions secrets or .env.local)
# AWS_SECRET_KEY       — AWS secret key (from GitHub Actions secrets or .env.local)
# TOOL_API_KEY         — Tool API key (from GitHub Actions secrets or .env.local)
#
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

# Generate frontend/.env.local with VITE_ prefix
cat > frontend/.env.local << EOF
VITE_BACKEND_BASE_URL=https://xaa.hieunm.io.vn
VITE_PUBLIC_DISTRIBUTION=https://clf.hieunm.io.vn
VITE_FACEBOOK_APP_ID=$FACEBOOK_APP_ID
VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
VITE_AD_TAG_URL=$AD_TAG_URL
EOF

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
