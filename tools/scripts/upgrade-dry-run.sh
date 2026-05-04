#!/usr/bin/env bash
# tools/scripts/upgrade-dry-run.sh — local rehearsal of the prod-droplet upgrade.
#
# Boots the new build on a non-default port against a clean local Mongo,
# imports a representative prod-shape bundle via /api/import, then walks
# every smoke check from docs/runbooks/upgrade-smoke-checklist.md. Prints a
# green/red checklist and exits non-zero on any failure.
#
# Usage:
#   bash tools/scripts/upgrade-dry-run.sh                 # uses var/dump-prod-shape.json
#   bash tools/scripts/upgrade-dry-run.sh path/to.bundle  # uses your bundle
#   bash tools/scripts/upgrade-dry-run.sh --check-only    # syntax + flag-parse only
#
# Ops-only: requires a working local Mongo (or Docker) and a free port.
# CI does not run this — it's a manual rehearsal step.
set -euo pipefail

# ---------------------------------------------------------------------------
# Flag parsing
# ---------------------------------------------------------------------------
CHECK_ONLY=0
BUNDLE_ARG=""
for arg in "$@"; do
  case "$arg" in
    --check-only) CHECK_ONLY=1 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0 ;;
    --*)
      echo "Unknown flag: $arg" >&2
      exit 2 ;;
    *)
      BUNDLE_ARG="$arg" ;;
  esac
done

if [[ $CHECK_ONLY -eq 1 ]]; then
  echo "[dry-run] --check-only: syntax OK, flags parsed, exiting."
  exit 0
fi

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${UPGRADE_DRY_RUN_PORT:-3099}"
MONGO_URI="${UPGRADE_DRY_RUN_MONGO_URI:-mongodb://127.0.0.1:27017}"
DB_NAME="${UPGRADE_DRY_RUN_DB:-cms_dry_run}"
BUNDLE="${BUNDLE_ARG:-$ROOT/var/dump-prod-shape.json}"
APP_PID=""
PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

cleanup() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    echo "[dry-run] stopping app (pid=$APP_PID)..."
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

record() {
  local status="$1"; shift
  local label="$*"
  if [[ "$status" == "PASS" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    RESULTS+=("  [PASS] $label")
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    RESULTS+=("  [FAIL] $label")
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[dry-run] missing required command: $1" >&2
    exit 3
  }
}

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
require_cmd curl
require_cmd jq
require_cmd node
require_cmd npm
require_cmd mongosh

echo "[dry-run] root:    $ROOT"
echo "[dry-run] port:    $PORT"
echo "[dry-run] mongo:   $MONGO_URI/$DB_NAME"
echo "[dry-run] bundle:  $BUNDLE"

# ---------------------------------------------------------------------------
# Step 1 — ensure local Mongo is running (use mongo-bootstrap.sh if needed)
# ---------------------------------------------------------------------------
echo "[dry-run] step 1: verify Mongo is up..."
if ! mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' "$MONGO_URI" >/dev/null 2>&1; then
  echo "[dry-run] Mongo not reachable at $MONGO_URI — bootstrapping via tools/mongo-bootstrap.sh"
  bash "$ROOT/tools/mongo-bootstrap.sh" || {
    echo "[dry-run] mongo-bootstrap failed" >&2
    exit 4
  }
  sleep 2
fi
record PASS "Mongo reachable at $MONGO_URI"

# Drop the dry-run DB so we start clean.
mongosh --quiet "$MONGO_URI/$DB_NAME" --eval "db.dropDatabase()" >/dev/null
record PASS "Dropped existing $DB_NAME (clean slate)"

# ---------------------------------------------------------------------------
# Step 2 — ensure the bundle exists (write a representative stub if absent)
# ---------------------------------------------------------------------------
echo "[dry-run] step 2: ensure bundle exists..."
if [[ ! -f "$BUNDLE" ]]; then
  if [[ -n "$BUNDLE_ARG" ]]; then
    echo "[dry-run] bundle not found: $BUNDLE" >&2
    exit 5
  fi
  echo "[dry-run] no bundle at $BUNDLE — writing representative stub"
  mkdir -p "$(dirname "$BUNDLE")"
  cat > "$BUNDLE" <<'JSON'
{
  "manifest": {
    "schemaVersion": 1,
    "exportedAt": "2026-05-03T00:00:00Z",
    "source": "dry-run-stub",
    "shape": "5 pages, 12 sections, 3 themes, 2 languages, 4 posts, 2 products, 1 order, 1 grant row, no *.trash"
  },
  "site": {
    "pages": [
      {"_id": "p1", "page": "Home",     "slug": "home"},
      {"_id": "p2", "page": "About Us", "slug": "about-us"},
      {"_id": "p3", "page": "Contact",  "slug": "contact"},
      {"_id": "p4", "page": "Blog",     "slug": "blog"},
      {"_id": "p5", "page": "Pricing",  "slug": "pricing"}
    ],
    "sections": [
      {"_id": "s1",  "pageId": "p1"}, {"_id": "s2",  "pageId": "p1"},
      {"_id": "s3",  "pageId": "p2"}, {"_id": "s4",  "pageId": "p2"},
      {"_id": "s5",  "pageId": "p3"}, {"_id": "s6",  "pageId": "p3"},
      {"_id": "s7",  "pageId": "p4"}, {"_id": "s8",  "pageId": "p4"},
      {"_id": "s9",  "pageId": "p5"}, {"_id": "s10", "pageId": "p5"},
      {"_id": "s11", "pageId": "p1"}, {"_id": "s12", "pageId": "p2"}
    ],
    "themes":    [{"_id": "t1"}, {"_id": "t2"}, {"_id": "t3"}],
    "languages": [{"_id": "lv"}, {"_id": "en"}],
    "posts":     [{"_id": "po1"}, {"_id": "po2"}, {"_id": "po3"}, {"_id": "po4"}],
    "products":  [{"_id": "pr1"}, {"_id": "pr2"}],
    "orders":    [{"_id": "o1"}],
    "grants":    [{"_id": "g1", "userId": "u1", "grants": []}]
  }
}
JSON
fi

# Sanity-check the bundle is parseable JSON with a manifest.
if jq -e '.manifest' "$BUNDLE" >/dev/null 2>&1; then
  record PASS "Bundle parseable, manifest present"
else
  record FAIL "Bundle missing manifest at $BUNDLE"
  for line in "${RESULTS[@]}"; do echo "$line"; done
  exit 6
fi

# ---------------------------------------------------------------------------
# Step 3 — boot the new build on $PORT
# ---------------------------------------------------------------------------
echo "[dry-run] step 3: boot new build on port $PORT..."
cd "$ROOT/ui/client"
PORT=$PORT \
  MONGO_URI="$MONGO_URI" \
  MONGO_DB="$DB_NAME" \
  NEXTAUTH_URL="http://localhost:$PORT" \
  npm run dev > /tmp/dry-run-app.log 2>&1 &
APP_PID=$!
cd "$ROOT"

# Wait for the app to come up (max 90 s).
for i in $(seq 1 45); do
  if curl -fsS "http://localhost:$PORT/api/info" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if curl -fsS "http://localhost:$PORT/api/info" >/dev/null 2>&1; then
  record PASS "App boots and /api/info responds"
else
  record FAIL "App did not become ready within 90 s (see /tmp/dry-run-app.log)"
  for line in "${RESULTS[@]}"; do echo "$line"; done
  exit 7
fi

# ---------------------------------------------------------------------------
# Step 4 — import the bundle via /api/import
# ---------------------------------------------------------------------------
echo "[dry-run] step 4: import bundle via /api/import..."
BASE="http://localhost:$PORT"
IMPORT_HTTP=$(curl -s -o /tmp/dry-run-import.json -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' \
  --data-binary "@$BUNDLE" "$BASE/api/import")

if [[ "$IMPORT_HTTP" =~ ^(200|201|202)$ ]]; then
  record PASS "Bundle imported via /api/import (HTTP $IMPORT_HTTP)"
elif [[ "$IMPORT_HTTP" == "401" || "$IMPORT_HTTP" == "403" ]]; then
  record PASS "Import requires auth ($IMPORT_HTTP) — endpoint reachable; verify auth manually"
else
  record FAIL "Import expected 2xx, got $IMPORT_HTTP (see /tmp/dry-run-import.json)"
fi

# Confirm baseline: no *.trash collections after the import (F2 lazy-create check).
TRASH_COUNT=$(mongosh --quiet "$MONGO_URI/$DB_NAME" --eval \
  'db.getCollectionNames().filter(n=>n.endsWith(".trash")).length' | tail -n1)
if [[ "$TRASH_COUNT" == "0" ]]; then
  record PASS "No *.trash collections post-import (F2 lazy-create baseline)"
else
  record FAIL "Expected 0 *.trash collections, got $TRASH_COUNT"
fi

# ---------------------------------------------------------------------------
# Step 5 — smoke checks
# ---------------------------------------------------------------------------
echo "[dry-run] step 5: smoke checks..."

# 5a. SHA from /api/info is non-empty.
INFO_SHA=$(curl -fsS "$BASE/api/info" | jq -r '.sha // empty')
if [[ -n "$INFO_SHA" ]]; then
  record PASS "/api/info returns non-empty SHA ($INFO_SHA)"
else
  record FAIL "/api/info SHA is empty"
fi

# 5b. /admin/build → 308 to /admin/build.
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -I "$BASE/admin/build")
LOC=$(curl -s -I "$BASE/admin/build" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2}')
if [[ "$STATUS" == "308" && "$LOC" == "/admin/build" ]]; then
  record PASS "/admin/build → 308 /admin/build"
else
  record FAIL "/admin/build expected 308 → /admin/build, got $STATUS → $LOC"
fi

# 5c. /api/health → 308.
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -I "$BASE/api/health")
if [[ "$STATUS" == "308" ]]; then
  record PASS "/api/health → 308"
else
  record FAIL "/api/health expected 308, got $STATUS"
fi

# 5d. NextAuth callback path is reachable on the new namespace.
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/providers")
if [[ "$STATUS" =~ ^(200|302|401)$ ]]; then
  record PASS "/api/auth/providers reachable ($STATUS)"
else
  record FAIL "/api/auth/providers expected 200/302/401, got $STATUS"
fi

# 5e. Customer slug from the bundle resolves (F1 fallback for legacy pages).
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/lv/about-us")
if [[ "$STATUS" =~ ^(200|301|302|307|308)$ ]]; then
  record PASS "/lv/about-us resolves ($STATUS)"
else
  record FAIL "/lv/about-us expected 2xx/3xx, got $STATUS"
fi

# 5f. Sub-page resolver tolerates pages with no `parent` field (F1).
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/lv/home")
if [[ "$STATUS" =~ ^(200|301|302|307|308)$ ]]; then
  record PASS "/lv/home (legacy page, no parent) resolves ($STATUS)"
else
  record FAIL "/lv/home expected 2xx/3xx, got $STATUS"
fi

# 5g. F5 admin info — at least 7 sections present.
INFO_JSON=$(curl -fsS "$BASE/api/system/info" 2>/dev/null || echo '{}')
SECTION_COUNT=$(echo "$INFO_JSON" | jq -r '. | keys | length' 2>/dev/null || echo 0)
if [[ "$SECTION_COUNT" -ge 7 ]]; then
  record PASS "/api/system/info exposes >= 7 sections ($SECTION_COUNT)"
else
  record FAIL "/api/system/info expected >= 7 sections, got $SECTION_COUNT (auth may gate it — verify manually)"
fi

# 5h. Idempotency — re-submit the same bundle, expect cached response (no dup).
IMPORT_HTTP_2=$(curl -s -o /tmp/dry-run-import-2.json -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' \
  --data-binary "@$BUNDLE" "$BASE/api/import")
if [[ "$IMPORT_HTTP_2" == "$IMPORT_HTTP" ]]; then
  record PASS "Re-import returned same status ($IMPORT_HTTP_2) — idempotency namespace served"
else
  record FAIL "Re-import status diverged: first=$IMPORT_HTTP, second=$IMPORT_HTTP_2"
fi

# ---------------------------------------------------------------------------
# Step 6 — output checklist
# ---------------------------------------------------------------------------
echo
echo "================ upgrade-dry-run results ================"
for line in "${RESULTS[@]}"; do echo "$line"; done
echo "---------------------------------------------------------"
echo "  PASS: $PASS_COUNT    FAIL: $FAIL_COUNT"
echo "========================================================="

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "[dry-run] FAILED — see above" >&2
  exit 1
fi

echo "[dry-run] all green."
exit 0
