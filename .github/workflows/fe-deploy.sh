#!/usr/bin/env bash
#
# Frontend deploy script, executed on the server via SSH by the
# "Deploy Frontend" GitHub Actions workflow (.github/workflows/fe-deploy.yml).
#
# DEPLOY_BRANCH        — target branch (passed via envs)
# INSTALL_DEPS         — "true" to run yarn install before make publish
# GOOGLE_CLIENT_ID     — Google client ID (from GitHub Actions vars or .env.local)
# FACEBOOK_APP_ID      — Facebook app ID (from GitHub Actions vars or .env.local)
# AD_TAG_URL           — Ad tag URL (from GitHub Actions vars or .env.local)
#
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

BRANCH="${DEPLOY_BRANCH:-master}"

cd ~/projects/xiangqi

# Load config from GitHub Actions vars or .env.local fallback
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

load_config "GOOGLE_CLIENT_ID"
load_config "FACEBOOK_APP_ID"
load_config "AD_TAG_URL"

# Generate frontend/.env.local with VITE_ prefix
cat > frontend/.env.local << EOF
VITE_BACKEND_BASE_URL=https://xaa.hieunm.io.vn
VITE_PUBLIC_DISTRIBUTION=https://clf.hieunm.io.vn
VITE_FACEBOOK_APP_ID=$FACEBOOK_APP_ID
VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
VITE_AD_TAG_URL=$AD_TAG_URL
EOF

echo "=== Frontend deploy, branch: $BRANCH ==="

git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "--- Deploying frontend ---"
cd frontend

if [ "${INSTALL_DEPS:-false}" = "true" ]; then
  echo "Installing dependencies..."
  yarn install
fi

make publish

echo "=== Deployment completed ==="
