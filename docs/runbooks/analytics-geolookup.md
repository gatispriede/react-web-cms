# Analytics — IP → country lookup

Last updated: 2026-05-03

## Purpose

The first-party analytics feature (`services/features/Analytics/`) needs a 2-letter country code on each event for the dashboard's geo breakdown — without storing the source IP. This runbook covers the dataset that powers the lookup, the privacy contract, and the refresh cadence.

## Privacy contract

- The client IP is read **once** at the GraphQL boundary (`ui/client/pages/api/graphql.ts` → `getClientIp` hook on `ResolverHooks`).
- It is passed to `AnalyticsService.ingest(events, userId, ip)` which calls `geoLookup(ip)` and then drops the `ip` variable.
- The IP is **never** persisted in Mongo, **never** logged, and **never** returned to a client.
- Only the derived `country` (ISO 3166-1 alpha-2, e.g. `US`, `DE`, `LV`) is stored on the analytics row.
- The `country` field on `IAnalyticsEvent` is the only geo-identifying field. See the comment in `shared/types/IAnalytics.ts`.

If a future change needs the IP for a longer hop (rate-limit by region, geo-fenced features), keep that derivation **server-only**. Do not propagate the raw IP into a stored row.

## Dataset

- File: `infra/datasets/ip-to-country.json`
- Format: a sorted JSON array of `{s, e, cc}` rows where `s` and `e` are uint32 IPv4 numeric bounds (inclusive) and `cc` is the ISO 3166-1 alpha-2 country code.
- Source: [IP2Location LITE DB1](https://lite.ip2location.com/) — CC0 / public-domain. No license key required.
- IPv4-only. IPv6 callers resolve to `undefined`; the dashboard rolls them up under `"Unknown"`.
- The repository ships a tiny seed (~10 well-known ranges) so the boot path can verify the loader works on a fresh clone. **A production deploy MUST replace the seed with a full dataset before the analytics dashboard is meaningful.**

### Refresh

```bash
./tools/download-geolite.sh
```

The script:
1. Fetches the LITE DB1 ZIP.
2. Unzips the CSV.
3. Converts to the sorted `{s, e, cc}` JSON shape and writes `infra/datasets/ip-to-country.json`.

Cadence: **quarterly**. IP-to-country mappings shift slowly; quarterly is the IP2Location LITE refresh interval.

Ownership: rotates with whoever ships the next infra/deploy change. Add a calendar reminder if your team prefers explicit ownership.

### Alternative: MaxMind GeoLite2

The MaxMind GeoLite2 binary is well-known and slightly more accurate, but:
- Requires accepting the MaxMind End User License Agreement.
- Requires a free MaxMind license key (account signup).
- Ships in MaxMind's binary `.mmdb` format — needs the `maxmind` npm package, which violates the no-new-deps constraint.

If you migrate, replace `geoLookup.ts` with a thin wrapper around `maxmind`'s reader. Keep the `loadDataset` / `geoLookup` exports identical so the AnalyticsService doesn't have to change.

## Operational notes

- **Missing dataset on boot**: `geoLookup.ts` logs a single warning (`scope: analytics.geo`) and returns `undefined` for every lookup. Ingest keeps working; the dashboard shows everything under "Unknown" until the dataset is restored.
- **Override path for tests / staging**: set `GEOLITE_DATASET_PATH=/abs/path/to/ip-to-country.json`.
- **Performance**: O(log N) binary search per lookup. With ~600K rows the cost is ~20 comparisons — sub-microsecond. The synchronous design keeps the `trackEvent` GraphQL mutation fast.
- **Memory**: the full LITE DB1 JSON is ~10 MB on disk and roughly the same in-process. Acceptable for a single Node instance; if you shard the API tier, each instance pays this cost once at boot.
