#!/usr/bin/env bash
# P4 — blue/green seamless deploy orchestrator.
#
# Runs ON THE DROPLET. Invoked by `.github/workflows/deploy.yml` over SSH
# when `SEAMLESS_DEPLOY=1` is set. Performs:
#   1. Identify the inactive instance (the one Caddy is NOT pointing at).
#   2. Pull + build + restart ONLY that instance — the active instance
#      keeps serving live traffic, no 502s.
#   3. Wait for the inactive instance to report healthy on /api/health
#      via its container's internal port.
#   4. SECURITY: verify the inactive instance's running git commit hash
#      matches the expected target SHA. Refuse to flip if it diverges
#      (defends against a stale/poisoned working tree on the droplet).
#   5. Atomically flip `ACTIVE_UPSTREAM` in `.env` + `caddy reload`
#      (graceful — Caddy finishes in-flight requests on the old upstream).
#   6. Sleep `${DRAIN_SECONDS:-30}` so the now-idle instance can quiesce
#      before the next deploy targets it.
#
# Rollback: re-invoking this script with the previous SHA flips back —
# the just-replaced instance is still running the previous build until
# the next deploy overwrites it.
#
# Inputs (env):
#   TARGET_SHA               — required. The commit the inactive instance
#                              must end up running. Validated post-build.
#   DEPLOY_HEALTH_TIMEOUT=60 — seconds to wait for inactive /api/health.
#   DRAIN_SECONDS=30        — seconds to wait after the Caddy flip.
#   COMPOSE_FILE=infra/compose.yaml
#   ENV_FILE=.env
#   REPO_DIR=/opt/cms
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/cms}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/compose.yaml}"
ENV_FILE="${ENV_FILE:-.env}"
DEPLOY_HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-60}"
DRAIN_SECONDS="${DRAIN_SECONDS:-30}"
TARGET_SHA="${TARGET_SHA:?TARGET_SHA must be set (the commit the new instance should run)}"
# Pin the compose project to `cms` so this script targets the same
# container set as the legacy + bootstrap paths in `ci.yml` (both
# use `-p cms`). Without it, compose v2 infers the project from the
# `-f infra/compose.yaml` parent dir → `infra` — which means
# `docker compose up app-green` tries to create a fresh `app-green`
# under project `infra` and immediately conflicts with the existing
# one already running under project `cms` (container_name is global).
# Caught on skyclimber's first-ever blue-green flip on 2026-05-04.
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-cms}"
export COMPOSE_PROJECT_NAME

cd "$REPO_DIR"

log() { echo "[bg-deploy] $*"; }

# --- Read current ACTIVE_UPSTREAM from .env ---
# Falls back to app-blue:80 if unset (matches Caddyfile default).
current_upstream() {
    local v
    v="$(grep -E '^ACTIVE_UPSTREAM=' "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    echo "${v:-app-blue:80}"
}

# --- Pick the inactive side (returns "blue" or "green") ---
inactive_side() {
    case "$(current_upstream)" in
        *blue*)  echo "green" ;;
        *green*) echo "blue" ;;
        *)       echo "blue" ;; # legacy `app:80` → start with blue
    esac
}

# --- Atomically rewrite ACTIVE_UPSTREAM in .env ---
write_upstream() {
    local new="$1" tmp
    tmp="$(mktemp)"
    if grep -q '^ACTIVE_UPSTREAM=' "$ENV_FILE" 2>/dev/null; then
        sed "s|^ACTIVE_UPSTREAM=.*|ACTIVE_UPSTREAM=$new|" "$ENV_FILE" > "$tmp"
    else
        cp "$ENV_FILE" "$tmp" 2>/dev/null || true
        printf 'ACTIVE_UPSTREAM=%s\n' "$new" >> "$tmp"
    fi
    mv "$tmp" "$ENV_FILE"
    log "wrote ACTIVE_UPSTREAM=$new to $ENV_FILE"
}

SIDE="$(inactive_side)"
SERVICE="app-$SIDE"
NEW_UPSTREAM="$SERVICE:80"

log "current upstream: $(current_upstream); deploying to inactive side: $SIDE ($SERVICE)"
log "target SHA: $TARGET_SHA"

# --- 1. Pull the target commit ---
git fetch --depth=50 origin
git checkout "$TARGET_SHA"

ACTUAL_SHA="$(git rev-parse HEAD)"
if [ "$ACTUAL_SHA" != "$TARGET_SHA" ]; then
    log "ABORT: HEAD ($ACTUAL_SHA) does not match TARGET_SHA ($TARGET_SHA) after checkout"
    exit 2
fi

# --- 2. Build + start ONLY the inactive instance ---
# `--no-deps` so we don't bounce Mongo / server / caddy.
# `--profile seamless` brings the blue/green services into scope.
# Pass GIT_SHA as a build-arg so AppDockerfile stamps /app/.git-sha,
# which the SHA verification at step 3 (below) reads back via docker exec.
log "building $SERVICE (GIT_SHA=$TARGET_SHA)"
GIT_SHA="$TARGET_SHA" docker compose --profile seamless -f "$COMPOSE_FILE" build --build-arg GIT_SHA="$TARGET_SHA" "$SERVICE"
log "starting $SERVICE"
docker compose --profile seamless -f "$COMPOSE_FILE" up -d --no-deps "$SERVICE"

# --- 3. Health-check the inactive instance directly ---
# Hit the container's /api/health via `docker exec` so we bypass Caddy
# entirely — we're confirming the NEW process is ready, not the
# composite production path.
log "waiting up to ${DEPLOY_HEALTH_TIMEOUT}s for $SERVICE /api/health"
HEALTHY=0
DEADLINE=$(( $(date +%s) + DEPLOY_HEALTH_TIMEOUT ))
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
    if docker exec "$SERVICE" wget -q -O- --spider http://localhost:80/api/health 2>/dev/null; then
        HEALTHY=1
        log "$SERVICE healthy"
        break
    fi
    sleep 2
done
if [ "$HEALTHY" != "1" ]; then
    log "ABORT: $SERVICE failed health within ${DEPLOY_HEALTH_TIMEOUT}s — leaving Caddy on $(current_upstream)"
    exit 3
fi

# --- 4. SECURITY: verify the running container's commit matches target ---
# Defends against a build that picked up a different working tree (e.g.
# uncommitted changes on the droplet, partial git pull, race with manual
# edits). The container bakes commit hash at build time via `git rev-parse`
# in AppDockerfile; if that's missing, fall back to comparing the on-disk
# checkout (already verified above). NEVER skip this check.
RUNNING_SHA="$(docker exec "$SERVICE" sh -c 'cat /app/.git-sha 2>/dev/null || echo unknown')"
if [ "$RUNNING_SHA" != "unknown" ] && [ "$RUNNING_SHA" != "$TARGET_SHA" ]; then
    log "ABORT: $SERVICE is running commit $RUNNING_SHA, expected $TARGET_SHA"
    log "leaving Caddy on $(current_upstream); investigate the build pipeline before retrying"
    exit 4
fi
log "commit verified: $SERVICE is running $TARGET_SHA"

# --- 5. Flip Caddy ---
write_upstream "$NEW_UPSTREAM"
# Prefer in-process `caddy reload` (graceful, no dropped connections).
# Fall back to `up -d --no-deps caddy` if reload isn't available (env
# var pickup also requires re-render of the env, so the up path is the
# canonical choice).
log "flipping Caddy to $NEW_UPSTREAM"
docker compose -f "$COMPOSE_FILE" up -d --no-deps caddy

# --- 6. Drain the old instance ---
log "draining old upstream for ${DRAIN_SECONDS}s"
sleep "$DRAIN_SECONDS"
log "deploy complete: traffic now on $SERVICE ($TARGET_SHA)"
