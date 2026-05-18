# Terraform + Kamal migration

Status: **Shipped (funisimo)** — 2026-05-08
Skyclimber pending: own DO API token + parallel cutover.
Last updated: 2026-05-08

Replaced the bash deploy stack (`tools/blue-green-deploy.sh` + the 250-line inline ssh script in `.github/workflows/ci.yml`) with **Terraform** for infrastructure and **[Kamal 2](https://kamal-deploy.org/)** for app deploy. Plus pushes the built image to GHCR so droplets stop running `next build` in-container.

## What actually shipped (vs the original plan)

The original spec proposed `kamal deploy` with kamal-proxy + per-tenant secrets in GHA. The shipped reality (after several iterations on 2026-05-08) diverges in five ways. **Operator runbook with current truth: [`docs/runbooks/kamal-deploy.md`](../../runbooks/kamal-deploy.md).**

| Spec said | Shipped reality | Why diverged |
|---|---|---|
| `kamal deploy` with kamal-proxy on droplet | `kamal app boot` only, no kamal-proxy | Caddy already binds 80/443; running kamal-proxy alongside requires non-default ports (extra moving parts). `proxy: false` at role level disables it. |
| `kamal-proxy` does blue-green slot mgmt | Caddy + docker network alias rotation does the swap | Without kamal-proxy, swap happens via `docker network connect ... --alias cms-web` post-boot. Caddy's `lb_try_duration 30s` covers the swap gap. |
| 9 secrets mirrored into GHA repo settings | `options.env-file: /opt/cms/.env` reads from droplet | The legacy compose stack already kept secrets there; mirroring is friction without value for a single-droplet setup. |
| Per-destination `config/deploy.<tenant>.yml` from day one | Single `config/deploy.yml` (funisimo only) | One Kamal target until skyclimber gets its API token. When that lands, split base + per-tenant. |
| `output: 'standalone'` for slim images (~600 MB) | Multi-stage non-standalone (~2 GB) | Standalone tracer missed ESM-conditional `dist/` files (`@reduxjs/toolkit`, etc.) and pre-rendered against empty in-memory Mongo at build time. Reverted; revisit with proper testing. |

## Footguns we hit (so the next operator doesn't)

1. **Kamal v2.11 hardcodes `--network kamal`** ([`commands/app.rb:21`](https://github.com/basecamp/kamal/blob/main/lib/kamal/commands/app.rb)). No deploy.yml override. CI must pre-create the network on the droplet.
2. **Kamal v2.11 always tries to register with `kamal-proxy`** unless the role-level `proxy: false` is set. Without it, `kamal app boot` succeeds at `docker run` then fails with `No such container: kamal-proxy` and stops the just-booted container.
3. **Kamal v2's `deploy.yml` doesn't accept `ssh.options`** — host-key verification is bypassed via the GHA runner's `~/.ssh/config`, not via deploy.yml.
4. **Kamal v2's `deploy.yml` doesn't accept `proxy: false` at top level** (kamal expects a hash there). The role-level `servers.<role>.proxy: false` is what works.
5. **Kamal v2 names containers `<service>-<role>-<full-sha>`** — versioned, hardcoded. Caddy's stable upstream name resolves via a docker network alias post-boot.
6. **`tools/docker-prebuild.js` boots an empty in-memory Mongo at image build time.** Anything pre-rendered via `getStaticProps` bakes empty-Mongo state. Fix per page: convert to `getServerSideProps`, or add a post-deploy `/api/revalidate` step.
7. **GHCR's `delete:packages` PAT scope is separate from `write:packages`.** Bulk version cleanup needs the delete scope explicitly.
8. **A classic PAT pushing to `.github/workflows/*.yml` requires `workflow` scope.** Without it, push is rejected with "refusing to allow a Personal Access Token to create or update workflow".
9. **Local `npm run dev` ≠ production image.** Set up a local-prod-test stack ([`docs/runbooks/local-prod-test.md`](../../runbooks/local-prod-test.md)) and validate before pushing risky changes.

---

## Why migrate

The current setup hit two blocking bugs in a single week (YAML heredoc indent, SSH idle-disconnect mid-build) and a third config bug from copy-pasting the wrong content into a deploy secret. Root cause: deploy logic, droplet bootstrap, env rewriting, image build, container swap, and health probing are all wedged into one stringly-typed shell script that can only be tested by running a real deploy. There is no declarative source of truth for what infra exists.

Kamal solves the deploy-script problem; Terraform solves the infra-state problem; GHCR solves the in-droplet build problem.

---

## Why Kamal (not Coolify / Dokploy / DO App Platform)

The CMS is cattle-not-pets — droplets are disposable because content is reproducible from a bundle export. That alignment is exactly what Kamal assumes:

- **1 repo = 1 app** matches funisimo and skyclimber exactly (one Next.js site per droplet).
- **Zero server-side daemon.** No Coolify dashboard eating 5–25% CPU on a 1-vCPU droplet, no Dokploy postgres for the platform itself.
- **CLI + YAML, no UI.** We're already comfortable with the GitHub secrets + ci.yml workflow.
- **Battle-tested at scale.** 37signals runs HEY (their email service) on Kamal.
- **Direct mapping** from current bash: build → push → SSH → pull → swap is exactly what Kamal does declaratively.

DO App Platform was rejected because it's container-only — our `/uploads/*` bind-mount pattern doesn't survive a managed-platform redeploy without paying for DO Spaces or an external object store.

---

## Cattle-not-pets implications

This migration gets simpler because we don't care about preserving droplet state:

- **Skip Mongo backups / managed Mongo.** Bundle export is the backup. Droplet dies → spin up a fresh one with Terraform → import a recent bundle → done.
- **Skip the broken Mongo healthcheck fix.** It's cosmetic; we don't gate dependent services on Mongo health. Doesn't matter for a fresh droplet either.
- **Skip volume migration.** Uploads on the existing droplet can be re-uploaded after a clean rebuild. Or `scp` the existing `/opt/cms/uploads` once before flipping DNS.

If those constraints change later (multi-tenant, real customer data, audit requirements), revisit this section first.

---

## What stays

- **Caddy auto-TLS.** Kamal-proxy can do Let's Encrypt too, but we already have static `/uploads/*`, `/design-v2/*`, and `/api/*.jpg` legacy paths served by Caddy via `file_server`. Chain Caddy in front of kamal-proxy: Caddy → kamal-proxy → app. Minimal change.
- **`compose.dev.yaml` for local dev.** Kamal's docs explicitly recommend Compose for dev.
- **GitHub Actions** as the trigger surface. Kamal runs from CI, not from a self-hosted runner.

## What goes

- `tools/blue-green-deploy.sh` — replaced by `kamal deploy` + kamal-proxy's blue-green logic.
- The 250-line inline ssh script in `ci.yml` — replaced by a 5-line `kamal deploy` invocation.
- `DEPLOY_ENV_FILE_1` / `DEPLOY_ENV_FILE_2` GitHub secrets — replaced by Kamal's [secrets management](https://kamal-deploy.org/docs/configuration/environment-variables/) (1Password, AWS SSM, or env at the CI level).
- Per-deploy `npm install` + `next build` on the droplet — moves to a single CI build that pushes to a registry.

---

## Scope of the chunk

Everything below ships as one cohesive deliverable. Internal ordering is execution-order, not separately-shippable phases — every step is required for the next to function, and the migration is only useful when the whole chain runs end-to-end.

**Infra-as-code (Terraform)**
- `terraform/` directory at repo root
- State backend: Terraform Cloud free tier (5 users, 500 resources) or DO Spaces
- `terraform import` existing droplets, reserved IPs, firewalls, DNS records
- Reusable droplet module so adding a third tenant is one module call
- `terraform plan` shows zero diff against live infra at handoff

**Image registry (GHCR)**
- CI builds `infra/AppDockerfile` once and pushes `ghcr.io/gatispriede/cms:<sha>` per commit
- Cleanup policy: keep last 10 SHA-tagged images per branch
- Droplets pull instead of build — cold-deploy drops 6-8min → ~30s
- GHCR free for public repos; ~$0-3/mo for private at our scale

**App deploy (Kamal)**
- `config/deploy.yml` + `config/deploy.skyclimber.yml`
- `kamal setup` provisions kamal-proxy on each droplet (binds 8080; Caddy stays on 80/443 → reverse-proxies to kamal-proxy)
- `kamal deploy` replaces `tools/blue-green-deploy.sh`
- Kamal's blue-green slot logic supersedes ours; `ACTIVE_UPSTREAM` env var goes away
- CI workflow shrinks from ~250 lines to a 5-line `kamal deploy --destination=<env>` call

**Cutover and validation**
- Test droplet provisioned via Terraform module, used as the kamal-setup target before touching prod
- Funisimo migrated first; skyclimber follows once funisimo is stable for a week
- Single revert path: roll back the migration commit + redeploy via the legacy bash on the previous master tag (kept in `tools/legacy/blue-green-deploy.sh` for one release cycle, then deleted)

---

## Files to touch

**New**
- `terraform/` — providers, droplets, DNS, firewall, reserved IPs, state backend config
- `config/deploy.yml`, `config/deploy.skyclimber.yml` — Kamal configs
- `infra/AppDockerfile` adjustments for GHCR push (multi-stage, tag-aware)
- `tools/legacy/blue-green-deploy.sh` — moved from `tools/`, kept one cycle for revert path

**Modified**
- `.github/workflows/ci.yml` — replace inline ssh script with `kamal deploy`; add GHCR push step
- `infra/Caddyfile` — upstream changes from `app:80` to `kamal-proxy:8080`
- `secrets.md` — replace `DEPLOY_ENV_FILE_*` documentation with Kamal secrets path

**Deleted**
- `tools/blue-green-deploy.sh` (after revert window closes)
- `DEPLOY_ENV_FILE_1` / `DEPLOY_ENV_FILE_2` GitHub secrets (after Kamal cutover stable)

---

## Acceptance

1. `terraform plan` against live infra returns "no changes" — every existing droplet, IP, firewall, and DNS record is reflected in code.
2. CI build pushes a tagged image to GHCR; `docker run ghcr.io/gatispriede/cms:<sha>` boots cleanly locally.
3. `kamal deploy` ships a new commit end-to-end in under 90 seconds (vs current ~6-8 minutes).
4. `kamal deploy --destination=skyclimber` does the same.
5. Caddy still serves `/uploads/*`, `/design-v2/*`, and TLS unchanged — no public regression.
6. A deliberate `kamal rollback` returns to the previous deployed slot under a minute.
7. The 250-line inline ssh script in `ci.yml` is gone; the deploy job is ≤30 lines.
8. **Cattle test:** terraform-destroy + terraform-apply produces a fresh, deployable droplet without manual SSH steps. Bundle import restores content; site serves traffic within 10 minutes of starting from zero.

---

## Effort

**L · ~6-8h AI for code/config + cutover validation wall-clock.** The AI portion writes terraform modules, kamal configs, the GHCR push step, and the cutover scripts. Wall-clock time dominates: terraform import discovery, kamal-setup against a fresh test droplet, the 1-week parallel-run validation window on funisimo before cutover, and DNS propagation. Realistic calendar window is 1-2 weeks of elapsed time; focused AI work is one solid afternoon.

(Pre-AI human estimate was ~7 working days spread over 2 calendar weeks.)

## Testids — for e2e

This is infra; no UI surface. **Testid-exempt.** End-to-end validation is the deploy CI job + the smoke check + the deliberate rollback test, not Playwright.

## MCP coverage

Infra; no editable content. **MCP-exempt.** Operational tools (`diagnostics.health`, `log.tail`) keep working since they target the running container regardless of how it got there.

## Docs follow-up

- `docs/runbooks/terraform.md` (new) — provider setup, state backend, common ops (`plan`, `apply`, `destroy`, `import`).
- `docs/runbooks/kamal-deploy.md` (new) — daily operator workflow, rollback procedure, secrets rotation.
- `docs/runbooks/ghcr.md` (new) — image lifecycle, retention, `docker pull` from a workstation for local repro.
- Replace `docs/runbooks/automatic-deployment.md` (legacy bash) and `docs/runbooks/seamless-deployment.md` (legacy blue-green) with pointers to the new Kamal runbook; keep the originals one cycle for archaeology.
- Update `docs/roadmap/shipped.md` on merge.
- Update `docs/architecture/deployment.md` (or equivalent) to reflect the new pipeline shape.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Kamal-proxy can't coexist with Caddy on 80/443. | Caddy continues to own 80/443; kamal-proxy binds 8080. Only the upstream port changes from `app:80` to `kamal-proxy:8080`. |
| Image push to GHCR adds CI runtime. | Compensated by removing 6–10min of on-droplet `next build`. Net deploy gets faster, not slower. |
| Kamal's "1 repo = 1 app" forces split if the CMS later co-locates services. | Add a second `config/deploy.<name>.yml`. Kamal supports multiple destinations. |
| Lose Caddy's caching layer. | Caddy stays in front; cache layer untouched. |
| Drift between `terraform import`-ed state and actual infra after months of manual DO console clicks. | The point of the import step is to catch and codify all drift. Run `terraform plan` weekly thereafter. |
| Cutover causes downtime. | Migration runs against funisimo first while skyclimber stays on the old path. If funisimo Kamal cutover regresses, the skyclimber bash path is the working fallback. |

---

## Worse-case alternatives

If Kamal proves wrong (multi-app per droplet, designer wanting a UI, multi-region):

- **[Haloy](https://haloy.dev/)** — newer Kamal-style tool, similar mental model, smaller community.
- **[Dokploy](https://dokploy.com/)** — when a UI becomes useful (e.g., multi-developer team, designers wanting to ship without a CLI).
- **[Fly.io](https://fly.io/)** — multi-region, scale-to-zero. Different mental model.

---

## Open questions (resolved)

- **Registry:** GHCR (free, fits our existing GitHub-centric workflow). DO Container Registry rejected ($5/mo, marginal pull-speed gain doesn't justify the cost at our scale).
- **Secrets:** Keep using GHA repo secrets via Kamal's `env: tags:` pattern. 1Password / SSM if a real driver appears.
- **Caddy stays as front:** Confirmed. Caddy → kamal-proxy → app.

---

## Sources

- [Kamal — Deploy web apps anywhere](https://kamal-deploy.org/)
- [Self-Hosted Deployment Tools Compared (2026) — Haloy](https://haloy.dev/blog/self-hosted-deployment-tools-compared)
- [Deploying with Kamal on AWS + Terraform — Pabluc](https://pabluc.medium.com/deploying-with-kamal-on-aws-ec2-ecr-and-cloudwatch-terraform-for-iasc-723ce666d661)
- [Terraform on DigitalOcean: Complete Guide (2026) — DevOpsTales](https://devopstales.com/tools-and-technologies/terraform-digitalocean-complete-guide-2026/)
- [Mkdev: A developer's take on Kamal](https://mkdev.me/posts/thoughts-on-kamal-30)
