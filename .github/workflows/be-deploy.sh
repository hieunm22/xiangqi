#!/usr/bin/env bash
#
# Backend deploy script, executed on the server via SSH by the
# "Deploy Backend" GitHub Actions workflow (.github/workflows/be-deploy.yml).
#
# DEPLOY_BRANCH        — target branch (passed via envs)
# INSTALL_DEPS         — "true" to run yarn install before make publish
# SERVER_IP            — Server IP address
# JWT_SECRET           — JWT secret
# GOOGLE_APP_PASSWORD  — Google app password
# GOOGLE_CLIENT_ID     — Google client ID
# FACEBOOK_APP_ID      — Facebook app ID
# FACEBOOK_APP_SECRET  — Facebook app secret
# REDIS_PASSWORD       — Redis password
# MONGO_PASSWORD       — MongoDB password
# AWS_ACCESS_ID        — AWS access ID
# AWS_SECRET_KEY       — AWS secret key
# TOOL_API_KEY         — Tool API key
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
load_config "FACEBOOK_APP_SECRET"
load_config "REDIS_PASSWORD"
load_config "MONGO_PASSWORD"
load_config "AWS_ACCESS_ID"
load_config "AWS_SECRET_KEY"
load_config "TOOL_API_KEY"

echo "=== Backend deploy, branch: $BRANCH ==="

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

echo "=== Deployment completed ==="
