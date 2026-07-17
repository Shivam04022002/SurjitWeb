# Surjit Finance

Monorepo for the Surjit Finance public website, CMS admin panel, and backend API.

| Directory   | What it is                        | Production URL                  |
| ----------- | --------------------------------- | ------------------------------- |
| `backend/`  | Node/Express + MongoDB API        | serves `/api` (port 5000)       |
| `frontend/` | Public website (Vite)             | https://surjitfinance.com       |
| `admin/`    | CMS admin panel (Vite)            | https://cms.surjitfinance.com   |

Per-directory setup lives in `backend/README.md`, `frontend/README.md`, and `admin/README.md`.

---

## Deployment

Production runs on a single EC2 host. The backend is managed by PM2; the
frontend and admin are static builds served by nginx.

| | |
| --- | --- |
| Host | `13.127.44.57` |
| Repo path | `/home/ubuntu/SurjitWeb` |
| PM2 process | `surjit-backend` |
| Config | `backend/ecosystem.config.js` |

`ecosystem.config.js` uses `cwd: __dirname`, so it resolves paths from its own
location. It carries no absolute paths and works from any clone directory —
do not reintroduce a hardcoded `cwd`.

### Standard deploy

SSH in and run the deploy script. These two commands are the whole routine:

```bash
ssh ubuntu@13.127.44.57
cd /home/ubuntu/SurjitWeb
./deploy.sh
```

`deploy.sh` is idempotent and safe to re-run. It will:

1. Refuse to run if the working tree has uncommitted changes.
2. `git pull --ff-only origin main`.
3. Install backend dependencies **only** if `backend/package.json` or
   `backend/package-lock.json` changed (or `node_modules` is missing).
4. Restart PM2 via `backend/ecosystem.config.js` and `pm2 save`.
5. Verify the process is `online`, confirm PM2's `cwd` matches the checkout,
   and poll `/api/health` until it serves.

It exits non-zero and prints recent PM2 logs if any step fails. A non-zero exit
means production is still on the previous release.

### Frontend / admin changes

`deploy.sh` covers the **backend only**. The Vite apps are built artifacts, so
changes under `frontend/` or `admin/` need a build and a copy to the nginx
webroot — `git pull` alone will not update the live site.

```bash
cd /home/ubuntu/SurjitWeb/frontend   # or admin/
npm ci && npm run build
# then publish dist/ to the nginx root configured for that site
```

### Verification

`deploy.sh` checks the API automatically. To confirm by hand:

```bash
# Backend, on the host
curl -fsS http://localhost:5000/api/health

# Public API (nginx -> port 5000). Returns JSON:
#   {"success":true,"message":"Surjit Finance API is running","data":{}}
curl -fsS https://cms-api.surjitfinance.com/api/health

# Static sites, from anywhere
curl -fsSI https://surjitfinance.com
curl -fsSI https://surjitfinance.com/about
curl -fsSI https://cms.surjitfinance.com
```

Expect `200 OK` from each. `/about` is client-side routed, so it also confirms
the nginx SPA fallback still works.

> The API is only reachable on the **`cms-api`** host — that is what
> `VITE_API_URL` / `VITE_API_BASE_URL` point at. `https://surjitfinance.com/api/health`
> also returns `200`, but it is the SPA's HTML fallback, not the API. Verify the
> backend against `cms-api.surjitfinance.com` (or localhost on the host), never
> against the www host.

Process state:

```bash
pm2 list                      # surjit-backend should be "online"
pm2 jlist                     # confirm cwd is /home/ubuntu/SurjitWeb/backend
pm2 logs surjit-backend --lines 50
```

### Rollback

**Prefer fixing forward.** Revert the bad commit and redeploy — this keeps
production and `main` in agreement:

```bash
git revert <bad-commit>
git push origin main
./deploy.sh
```

`rollback.sh` exists as a break-glass escape hatch only. It repoints PM2 at the
pre-migration deployment in `/home/ubuntu/projects/backend`:

```bash
./rollback.sh
```

That directory is **frozen at the point of the GitHub migration** and drifts
further behind `main` with every deploy — it is not "the last good release".
After running it, production is knowingly behind `main`, and the next
`./deploy.sh` silently undoes the rollback. Use it only to restore service in
an emergency, then fix forward promptly.

### Troubleshooting

**`bad interpreter: /usr/bin/env^M`** — the script was checked out with CRLF
line endings. Fix with `sed -i 's/\r$//' deploy.sh`.

**`Permission denied`** — restore the executable bit: `chmod +x deploy.sh`.

**PM2 `cwd` points at the old path** — a stale process from before the
migration is still registered. Re-register it from the current config:

```bash
pm2 delete surjit-backend
pm2 start backend/ecosystem.config.js
pm2 save
```

**App is `online` but not serving** — PM2 reports `online` as soon as the
process forks, before MongoDB connects. Check `pm2 logs surjit-backend` for
connection errors and confirm `backend/.env` is present (it is gitignored and
never arrives via `git pull`).
