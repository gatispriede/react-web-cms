#!/usr/bin/env bash
# Refresh the bundled IP→country dataset used by services/features/Analytics/geoLookup.ts.
#
# Source: IP2Location LITE DB1 (CC0 / public-domain). No license key
# required for the LITE tier — direct CSV download.
# Alternative: MaxMind GeoLite2 (requires accepting MaxMind license +
# user license key). See docs/runbooks/analytics-geolookup.md.
#
# Cadence: quarterly. Re-run, commit the resulting JSON if size allows
# (< 5 MB target — current LITE DB1 is ~15 MB CSV → ~10 MB JSON, so
# `infra/datasets/ip-to-country.json` is currently gitignored and must
# be regenerated on each fresh clone / deploy).
#
# Output: infra/datasets/ip-to-country.json — sorted JSON array of
# `{s, e, cc}` rows where s/e are uint32 IPv4 bounds (inclusive).
#
# Usage:
#   ./tools/download-geolite.sh                     # uses default IP2Location LITE DB1 URL
#   IP2LOCATION_TOKEN=<token> ./tools/download-geolite.sh   # auth'd download for higher rate limits
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/infra/datasets"
OUT_PATH="$OUT_DIR/ip-to-country.json"
TMP_CSV="$(mktemp -t ip2country.XXXXXX.csv)"
trap 'rm -f "$TMP_CSV"' EXIT

mkdir -p "$OUT_DIR"

# Public IP2Location LITE DB1 CSV. The unauth'd URL is rate-limited but
# adequate for quarterly refreshes.
DOWNLOAD_URL="${IP2LOCATION_URL:-https://download.ip2location.com/lite/IP2LOCATION-LITE-DB1.CSV.ZIP}"

echo "Downloading $DOWNLOAD_URL"
TMP_ZIP="$(mktemp -t ip2country.XXXXXX.zip)"
trap 'rm -f "$TMP_ZIP" "$TMP_CSV"' EXIT
curl -fsSL "$DOWNLOAD_URL" -o "$TMP_ZIP"

echo "Unzipping"
unzip -p "$TMP_ZIP" "*.CSV" > "$TMP_CSV"

echo "Converting CSV to sorted JSON at $OUT_PATH"
node - <<'JS'
const fs = require('node:fs');
const csv = fs.readFileSync(process.env.TMP_CSV, 'utf-8');
const rows = [];
for (const line of csv.split(/\r?\n/)) {
    if (!line) continue;
    // CSV format: "ip_from","ip_to","country_code","country_name"
    const m = line.match(/^"(\d+)","(\d+)","([A-Z-]{2})"/);
    if (!m) continue;
    const cc = m[3];
    if (cc === '-') continue; // unassigned ranges
    rows.push({s: Number(m[1]), e: Number(m[2]), cc});
}
rows.sort((a, b) => a.s - b.s);
fs.writeFileSync(process.env.OUT_PATH, JSON.stringify(rows));
console.log(`Wrote ${rows.length} rows`);
JS

echo "Done. Inspect with: jq 'length' $OUT_PATH"
