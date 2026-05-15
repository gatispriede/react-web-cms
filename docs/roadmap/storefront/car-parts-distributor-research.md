---
name: car-parts-distributor-research
description: Research car-parts distributors that expose an API (or comparable machine-readable interface) for attaching their catalogue to our warehouse. Output is a comparison matrix + recommended path A/B/C, not code.
status: research (no implementation jumps until path is selected)
---

# Car-parts distributor API research

## Goal

Identify which car-parts distributors / catalogues we can ingest into the existing warehouse layer (the same shape that backs Phase 1.C `WarehousePageSyncWorker` + `IProduct` + the ss.com cars-source path). Outcome is a comparison matrix + a recommended A / B / C acquisition path the operator picks before any code lands.

The cars-vertical work (Wave 7, ss.com integration) treats whole-vehicle listings as warehouse inventory. **Parts** are the natural next inventory class: higher SKU count, predictable shape, lower per-unit price, suitable for the same `commerce.checkoutEnabled` + cart + order-finalisation pipeline already shipped.

## Why now

- Cars-vertical foundations (`CarListingCard`, `CarSpecTable`, `CarComparisonTable`, `VatBadge`, `CarReservationCta`, `CarPhotoGallery`, `CarFinanceEstimator`) are in place. Parts re-use the same `IProduct` shape + the existing checkout flow with **zero schema changes**.
- The Latvian / Baltic operator audience asks repeatedly: "can I list parts too?" A clear API integration path turns that into a one-line yes.
- ss.com path A (partner licence) is the analogue we already discussed for cars. Parts catalogues sit on the same spectrum — A (commercial API) / B (RSS / public list pages) / C (full scrape; off the table for a commercial product).

## What to research

For each candidate, capture:

1. **Distributor identity** — name, region of coverage, B2B vs B2C orientation, public site URL
2. **Catalogue shape** — SKU count order-of-magnitude, OEM-cross-reference depth, image quality, multi-language metadata
3. **Interface** — REST / SOAP / GraphQL / TecDoc-compliant / FTP-XML / spreadsheet drop / scraping-only. Authentication model (API key / OAuth / mTLS / signed download links).
4. **Update cadence** — real-time, hourly, daily, weekly; webhook vs poll; delta or full-refresh
5. **Rate limits + quotas** — requests/minute, daily caps, surcharges
6. **Cost** — pricing tier shape (per-call / per-SKU-month / flat / revenue-share)
7. **Licence terms** — re-display permitted? branded re-sale permitted? deep-link required? logo attribution required?
8. **Integration effort estimate** — small (REST + JSON), medium (TecDoc compliance / SOAP), large (FTP + transformation pipeline)
9. **Acquisition path classification:**
   - **A** — formal partner API contract with explicit re-display + commercial-use clauses
   - **B** — public RSS / list pages / unofficial-but-tolerated read access (prototype-friendly, commercial-fragile)
   - **C** — scraping against ToS (off the table for a commercial product — flag but do not recommend)

## Candidate distributor list to seed the research

Operator review the priors before kickoff; remove or extend.

### European / Baltic-focused

- **TecDoc / TecAlliance** — the de-facto European parts-cross-reference dataset. Member-licensed; many distributors expose TecDoc-compliant feeds.
- **AutoDoc** — large EU online distributor (consumer-facing), affiliate / dropship programmes exist
- **EBROS** (LV) — Latvian parts wholesaler, B2B portal
- **DEPO Auto Parts** (LV) — Baltic retailer with B2B catalogue
- **AAS "Trasta auto"** / **Inter Cars Latvija** — wholesale-tier, Inter Cars has an established B2B API ("IC Catalog")
- **AD Auto** (Baltic AD network) — pan-Baltic AD-network B2B catalogue

### Pan-European wholesalers

- **Inter Cars** (PL HQ, Baltic + EU coverage) — IC Catalog B2B API, well-documented
- **Stahlgruber / PV Automotive** — German wholesaler, TecDoc-compliant
- **GROUPAUTO** — pan-European AD network
- **Doyen Auto** — UK-based EU distributor

### Marketplaces (data only — no warehouse ownership)

- **eBay Motors Parts** — Browse / Marketplace Insights APIs
- **Allegro** (PL) — REST API, very popular for parts in Baltics
- **Catawiki** (NL) — auctions; limited parts utility but possible

## Output artefact

A markdown matrix `docs/roadmap/storefront/_research/car-parts-distributors-matrix.md` with one row per distributor, plus a one-page recommendation: which 1-2 paths to prototype against (and which to back-channel for partner contracts). Includes:

- **Recommended starter:** the lowest-friction A-path candidate with adequate Baltic coverage
- **Prototype path:** the lowest-friction B-path candidate that lets us validate the warehouse-sync wiring end-to-end without partner negotiations
- **Disqualified:** any candidate whose licence terms forbid re-display

## Acquisition path decision (operator)

After research lands, operator picks A / B / C **per distributor**, same shape as the ss.com decision. No integration code ships until that decision is recorded in `docs/roadmap/storefront/car-parts-distributors-decision.md`.

## Files to touch (research-only)

- `docs/roadmap/storefront/_research/` — create dir; one matrix doc + per-distributor brief docs as the research lands
- `docs/ROADMAP.md` — log this item under the Storefront forward-work queue

## Implementation (deferred — separate roadmap items)

Each selected distributor becomes its own ingest-worker jump, modelled on `WarehousePageSyncWorker`:

- `services/features/Warehouse/<DistributorName>SyncWorker.ts` — cron-driven delta ingest
- `IProduct.source = '<distributor-slug>'` discriminator
- `RedirectsService` auto-301 on upstream slug renames (Phase 1.C-c precedent)
- Per-distributor `commerce.warehouseAutoSync` sub-flag
- MCP tools for manual re-sync + dry-run

## Acceptance (this item)

1. Comparison matrix doc lands with at least 6 candidates evaluated against the 8 axes above
2. Recommended A-path + B-path prototype candidates identified with rationale
3. Operator has signed off on the decision doc OR explicitly deferred
4. No integration code committed before sign-off

## Effort

**M · ~2-3 h research AI** + operator review wall-clock for partner-contract back-channels (out-of-band).

## Dependencies

- None (research-only); does not block other roadmap items.

## Out of scope

- The integration code itself (filed as per-distributor follow-up jumps once paths are selected)
- Tyre / wheel distributors (separate vertical; can re-use this template later)
- Body-shop / repair-service marketplace integrations (different product class — services, not parts)
