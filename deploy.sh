#!/usr/bin/env bash
#
# Deploy the Surjit Finance backend from the current checkout.
#
# Usage:  ./deploy.sh
#
# Pulls main, installs backend dependencies only when they actually changed,
# restarts PM2 from the repo's own ecosystem.config.js, and verifies the app
# is serving before reporting success.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
ECOSYSTEM="$BACKEND_DIR/ecosystem.config.js"
APP_NAME="surjit-backend"
HEALTH_URL="http://localhost:5000/api/health"

# Dependency manifests worth reinstalling for.
MANIFESTS=("backend/package.json" "backend/package-lock.json")

info()    { printf '\033[0;36m[deploy]\033[0m %s\n' "$1"; }
success() { printf '\033[0;32m[ok]\033[0m %s\n' "$1"; }
fail()    { printf '\033[0;31m[FAILED]\033[0m %s\n' "$1" >&2; }

# Report the failing line on any unexpected error, since set -e exits silently.
trap 'fail "Deployment aborted at line $LINENO. Production left on the previous release; investigate before retrying."' ERR

info "Repository: $REPO_ROOT"

# --- Preconditions --------------------------------------------------------
command -v git >/dev/null || { fail "git not found in PATH"; exit 1; }
command -v npm >/dev/null || { fail "npm not found in PATH"; exit 1; }
command -v pm2 >/dev/null || { fail "pm2 not found in PATH"; exit 1; }
[ -f "$ECOSYSTEM" ] || { fail "Missing $ECOSYSTEM"; exit 1; }

# Refuse to clobber uncommitted production edits -- a pull would either fail
# halfway or silently discard them.
if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
  fail "Working tree has uncommitted changes. Commit, stash, or revert them before deploying:"
  git -C "$REPO_ROOT" status --short >&2
  exit 1
fi

# --- Pull -----------------------------------------------------------------
BEFORE="$(git -C "$REPO_ROOT" rev-parse HEAD)"
info "Current commit: ${BEFORE:0:8}"

info "Pulling origin/main ..."
git -C "$REPO_ROOT" pull --ff-only origin main

AFTER="$(git -C "$REPO_ROOT" rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  info "Already up to date at ${AFTER:0:8}; redeploying the same commit."
else
  info "Updated ${BEFORE:0:8} -> ${AFTER:0:8}"
fi

# --- Install dependencies only when a manifest changed --------------------
DEPS_CHANGED=false
if [ "$BEFORE" != "$AFTER" ]; then
  for manifest in "${MANIFESTS[@]}"; do
    if ! git -C "$REPO_ROOT" diff --quiet "$BEFORE" "$AFTER" -- "$manifest"; then
      DEPS_CHANGED=true
      info "Changed: $manifest"
    fi
  done
fi

# node_modules can be missing on a fresh clone even when nothing changed.
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  info "backend/node_modules is absent; installing."
  DEPS_CHANGED=true
fi

if [ "$DEPS_CHANGED" = true ]; then
  info "Installing backend dependencies ..."
  # `npm ci` installs exactly the lockfile and is reproducible, but it needs a
  # lockfile in sync with package.json; fall back to `npm install` if not.
  if [ -f "$BACKEND_DIR/package-lock.json" ]; then
    npm --prefix "$BACKEND_DIR" ci --omit=dev || npm --prefix "$BACKEND_DIR" install --omit=dev
  else
    npm --prefix "$BACKEND_DIR" install --omit=dev
  fi
  success "Dependencies installed."
else
  info "Dependencies unchanged; skipping install."
fi

# --- Restart PM2 ----------------------------------------------------------
# `startOrRestart` handles both a running app and a cold boot after reboot.
info "Restarting $APP_NAME via ecosystem.config.js ..."
pm2 startOrRestart "$ECOSYSTEM" --update-env
pm2 save --force >/dev/null
success "PM2 restarted and process list saved."

# --- Verify ---------------------------------------------------------------
info "Verifying process status ..."
pm2 list

STATUS="$(pm2 jlist | node -e '
  let raw = "";
  process.stdin.on("data", d => raw += d);
  process.stdin.on("end", () => {
    const app = JSON.parse(raw).find(a => a.name === "surjit-backend");
    if (!app) { console.log("missing"); return; }
    console.log(`${app.pm2_env.status} ${app.pm2_env.pm_cwd} ${app.pm2_env.restart_time}`);
  });
')"

read -r PM2_STATE PM2_CWD PM2_RESTARTS <<< "$STATUS"

if [ "$PM2_STATE" != "online" ]; then
  fail "$APP_NAME is not online (state: ${PM2_STATE:-unknown}). Recent logs:"
  pm2 logs "$APP_NAME" --lines 30 --nostream >&2 || true
  exit 1
fi

if [ "$PM2_CWD" != "$BACKEND_DIR" ]; then
  fail "PM2 cwd is '$PM2_CWD' but this checkout is '$BACKEND_DIR'."
  fail "PM2 is running code from a different directory than the one just deployed."
  exit 1
fi

success "$APP_NAME online — cwd $PM2_CWD (restarts: $PM2_RESTARTS)"

# Confirm the app actually serves traffic, not merely that PM2 forked it.
# PM2 reports "online" the instant the process starts, before Mongo connects.
info "Waiting for $HEALTH_URL ..."
for attempt in $(seq 1 10); do
  if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    success "Health check passed."
    HEALTHY=true
    break
  fi
  sleep 1
done

if [ "${HEALTHY:-false}" != true ]; then
  fail "Health check did not pass within 10s. The process is up but not serving. Recent logs:"
  pm2 logs "$APP_NAME" --lines 30 --nostream >&2 || true
  exit 1
fi

trap - ERR
echo
success "Deployment complete — $APP_NAME running ${AFTER:0:8} from $BACKEND_DIR"
