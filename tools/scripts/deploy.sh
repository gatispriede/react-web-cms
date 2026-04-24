#!/usr/bin/env bash
# Local-build + rsync deploy for the CMS.
#
# Required env:
#   FUNISIMO_HOST         gatis@<droplet-ip>
#   FUNISIMO_REMOTE_PATH  /home/gatis/funisimo (absolute path on droplet)
#
# Optional env:
#   BUILD_PORT            defaults to 3000 — port the local standalone-graphql binds to
#   GRAPHQL_ENDPOINT      override if building against a tunnel to prod Mongo
#   SKIP_GQL              if set, assumes a standalone-graphql is already running
#
# Flow:
#   1. Start local standalone-graphql on $BUILD_PORT (unless SKIP_GQL)
#   2. Build Next with BUILD_PORT set so next-sitemap + getStaticProps can fetch
#   3. Rsync .next/, public/, package manifests, schema.graphql to droplet
#   4. On droplet: yarn install + pm2 reload web
#   5. Stop the locally-spawned graphql

set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/.." && pwd)
cd "$REPO"

: "${FUNISIMO_HOST:?FUNISIMO_HOST must be set to gatis@<droplet-ip>}"
: "${FUNISIMO_REMOTE_PATH:?FUNISIMO_REMOTE_PATH must be set to the repo dir on the droplet}"
: "${BUILD_PORT:=3000}"

GQL_PID=""
cleanup() {
    if [[ -n "${GQL_PID}" ]]; then
        echo "[deploy] stopping local standalone-graphql (PID $GQL_PID)"
        kill "$GQL_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

if [[ -z "${SKIP_GQL:-}" ]]; then
    echo "[deploy] starting local standalone-graphql on :$BUILD_PORT"
    NODE_SERVER_PORT=true npm run standalone-graphql-docker >/tmp/deploy-gql.log 2>&1 &
    GQL_PID=$!
    # Wait until port is accepting connections (max ~15 s)
    for i in $(seq 1 30); do
        if curl -fsS "http://localhost:$BUILD_PORT" -o /dev/null 2>/dev/null; then
            echo "[deploy] graphql up on :$BUILD_PORT"
            break
        fi
        sleep 0.5
    done
fi

echo "[deploy] building static artifacts"
BUILD_PORT=$BUILD_PORT GRAPHQL_ENDPOINT=${GRAPHQL_ENDPOINT:-"http://localhost:$BUILD_PORT/api/graphql"} \
    npm run build

echo "[deploy] syncing artifacts → $FUNISIMO_HOST:$FUNISIMO_REMOTE_PATH"
rsync -az --delete --exclude 'cache/' \
    "$REPO/src/frontend/.next/" \
    "$FUNISIMO_HOST:$FUNISIMO_REMOTE_PATH/src/frontend/.next/"

rsync -az --delete \
    "$REPO/src/frontend/public/" \
    "$FUNISIMO_HOST:$FUNISIMO_REMOTE_PATH/src/frontend/public/"

rsync -az \
    "$REPO/package.json" "$REPO/yarn.lock" "$REPO/next-sitemap.config.cjs" \
    "$REPO/next-i18next.config.js" \
    "$FUNISIMO_HOST:$FUNISIMO_REMOTE_PATH/"

rsync -az \
    "$REPO/src/Server/schema.graphql" \
    "$FUNISIMO_HOST:$FUNISIMO_REMOTE_PATH/src/Server/schema.graphql"

echo "[deploy] remote install + reload"
ssh "$FUNISIMO_HOST" bash -lc "'cd $FUNISIMO_REMOTE_PATH && yarn --frozen-lockfile && pm2 reload web'"

echo "[deploy] done — https://funisimo.pro"
