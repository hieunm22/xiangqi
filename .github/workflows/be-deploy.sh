#!/usr/bin/env bash
#
# Backend deploy script, executed on the server via SSH by the
# "Deploy Backend" GitHub Actions workflow (.github/workflows/be-deploy.yml).
#
# DEPLOY_BRANCH  — target branch (passed via envs)
# INSTALL_DEPS   — "true" to run yarn install before make publish
#
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

BRANCH="${DEPLOY_BRANCH:-master}"

cd ~/projects/xiangqi

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
