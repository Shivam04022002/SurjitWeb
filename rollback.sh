#!/usr/bin/env bash
#
# EMERGENCY ROLLBACK — reverts production to the pre-migration deployment at
# /home/ubuntu/projects/backend.
#
# Usage:  ./rollback.sh
#
# READ BEFORE RUNNING
# -------------------
# This does NOT roll back to "the last good deploy". It starts whatever code
# currently sits in the OLD pre-GitHub-migration directory, which is frozen at
# the point migration happened and drifts further behind main every deploy.
# It is a break-glass escape hatch, not a routine undo.
#
# To undo a bad deploy, prefer reverting the commit and redeploying:
#
#     git revert <bad-commit> && git push origin main && ./deploy.sh
#
# That keeps main and production in agreement. This script deliberately puts
# them out of agreement: the next `git pull && ./deploy.sh` silently undoes the
# rollback, so fix forward promptly.

set -euo pipefail

OLD_DIR="/home/ubuntu/projects/backend"
APP_NAME="surjit-backend"
HEALTH_URL="http://localhost:5000/api/health"

info()    { printf '\033[0;36m[rollback]\033[0m %s\n' "$1"; }
warn()    { printf '\033[0;33m[warn]\033[0m %s\n' "$1"; }
success() { printf '\033[0;32m[ok]\033[0m %s\n' "$1"; }
fail()    { printf '\033[0;31m[FAILED]\033[0m %s\n' "$1" >&2; }

trap 'fail "Rollback aborted at line $LINENO. Production may be STOPPED — check \`pm2 list\` immediately."' ERR

# --- Validate the rollback target BEFORE stopping anything ----------------
# Stopping first and discovering the old tree is gone would take production
# down with nothing to bring back up.
command -v pm2 >/dev/null || { fail "pm2 not found in PATH"; exit 1; }

if [ ! -d "$OLD_DIR" ]; then
  fail "Rollback target $OLD_DIR does not exist."
  fail "Nothing to roll back to. Production left running untouched."
  exit 1
fi

if [ ! -f "$OLD_DIR/server.js" ]; then
  fail "$OLD_DIR exists but contains no server.js — not a usable deployment."
  fail "Production left running untouched."
  exit 1
fi

if [ ! -d "$OLD_DIR/node_modules" ]; then
  fail "$OLD_DIR has no node_modules; the old release would crash on start."
  fail "Run 'npm install --omit=dev --prefix $OLD_DIR' first if you are sure."
  exit 1
fi

if [ ! -f "$OLD_DIR/.env" ]; then
  warn "$OLD_DIR/.env not found — the old release may fail to reach the database."
fi

info "Rollback target validated: $OLD_DIR"
warn "About to move production OFF the current release."
echo

# --- Stop the current process --------------------------------------------
info "Stopping $APP_NAME ..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 delete "$APP_NAME"
  success "Stopped and removed current $APP_NAME process."
else
  warn "$APP_NAME was not running under PM2; continuing."
fi

# --- Start the previous deployment ---------------------------------------
info "Starting previous deployment from $OLD_DIR ..."
if [ -f "$OLD_DIR/ecosystem.config.js" ]; then
  pm2 start "$OLD_DIR/ecosystem.config.js" --update-env
else
  warn "No ecosystem.config.js in $OLD_DIR; starting server.js directly."
  pm2 start "$OLD_DIR/server.js" --name "$APP_NAME" --cwd "$OLD_DIR"
fi

pm2 save --force >/dev/null
success "PM2 process list saved."

# --- Verify ---------------------------------------------------------------
pm2 list

info "Waiting for $HEALTH_URL ..."
for attempt in $(seq 1 10); do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep 1
done

if [ "${HEALTHY:-false}" != true ]; then
  fail "Rolled-back release is NOT serving traffic. Production is DOWN. Logs:"
  pm2 logs "$APP_NAME" --lines 40 --nostream >&2 || true
  exit 1
fi

trap - ERR
echo
success "ROLLBACK COMPLETED — $APP_NAME now running the previous release from $OLD_DIR"
warn "Production is now BEHIND main. Fix forward and redeploy as soon as possible."
