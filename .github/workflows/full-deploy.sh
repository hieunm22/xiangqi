#!/usr/bin/env bash
#
# Predefined full-deploy script, executed on the server via SSH by the
# "Manual Deploy" GitHub Actions workflow (.github/workflows/manual-deploy.yml).
#
# Always rebuilds both backend and frontend.
# The target branch is passed in through the DEPLOY_BRANCH env var.
#
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

BRANCH="${DEPLOY_BRANCH:-master}"

cd ~/projects/xiangqi

echo "=== Full deploy, branch: $BRANCH ==="

git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "--- Deploying backend ---"
cd backend
make publish
cd ..

echo "--- Deploying frontend ---"
cd frontend
make publish
cd ..

echo "=== Deployment completed ==="
