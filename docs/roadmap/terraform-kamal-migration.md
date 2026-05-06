# Terraform + Kamal migration

Status: Planned
Last updated: 2026-05-06

Replace the current bash deploy stack (`tools/blue-green-deploy.sh` + the 600-line inline ssh script in `.github/workflows/ci.yml`) with **Terraform** for infrastructure and **[Kamal 2](https://kamal-deploy.org/)** for app deploy.

---

## Why migrate

The current setup hit two blocking bugs in a single week (YAML heredoc indent, SSH idle-disconnect mid-build) and a third config bug from copy-pasting the wrong content into a deploy secret. Root cause: deploy logic, droplet bootstrap, env rewriting, image build, container swap, and health probing are all wedged into one stringly-typed shell script that can only be tested by running a real deploy. There is no declarative source of truth for what infra exists.

Kamal solves the deploy-script problem; Terraform solves the infra-state problem.

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

## Phased rollout

| Phase | Scope | Validation gate | Effort |
|---|---|---|---|
| **A** | `terraform import` existing droplets, reserved IPs, firewalls, DNS records into a `terraform/` directory. State remote (DO Spaces backend or Terraform Cloud free tier). | `terraform plan` shows zero diff against live infra. | 1 day |
| **B** | Set up GHCR (free for our private repo). Modify CI to **build + push** images from `infra/AppDockerfile` instead of building on droplet. Tag with commit SHA. | `docker run ghcr.io/gatispriede/cms:<sha>` boots locally. | 1 day |
| **C** | Add `config/deploy.yml` per droplet. Run `kamal setup` against a freshly-provisioned test droplet (Terraform module reused). | Hello-world deploy succeeds; kamal-proxy issues TLS. | 2 days |
| **D** | Migrate funisimo: parallel-run Kamal alongside current bash for a week. Trigger both on each push, compare outcomes. | Two consecutive Kamal-only deploys, including a deliberate rollback. | 2 days |
| **E** | Cut over funisimo: delete `tools/blue-green-deploy.sh`, replace the inline ssh script in `ci.yml` with `kamal deploy`. | Push to master → green deploy via Kamal only. | 1 day |
| **F** | Repeat E for skyclimber. Different `deploy.yml`, same migration steps. | Same. | 0.5 day |

**Total ~7 working days.** Can be spread over 2 calendar weeks alongside other work.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Kamal-proxy can't coexist with Caddy on 80/443. | Caddy continues to own 80/443; kamal-proxy binds 8080 (or whatever Caddy upstreams to). Only the upstream port changes from `app:80` to `kamal-proxy:8080`. |
| Image push to GHCR adds CI runtime. | Compensated by removing 6–10min of on-droplet `next build`. Net deploy gets faster, not slower. |
| Kamal's "1 repo = 1 app" forces split if the CMS later co-locates services. | Add a second `config/deploy.<name>.yml`. Kamal supports multiple destinations. |
| Lose Caddy's caching layer. | Caddy stays in front; cache layer untouched. |
| Drift between `terraform import`-ed state and actual infra after months of manual DO console clicks. | The point of Phase A is to catch and codify all drift. Run `terraform plan` weekly thereafter. |
| Existing GitHub secrets pattern (`DEPLOY_ENV_FILE_*`) is comfortable; switching loses muscle memory. | Migrate to Kamal secrets gradually; can keep the GHA-secret-→-env-file path as a Kamal env source for one deploy cycle. |

---

## Worse-case alternatives

If Kamal proves wrong (multi-app per droplet, designer wanting a UI, multi-region):

- **[Haloy](https://haloy.dev/)** — newer Kamal-style tool, similar mental model, smaller community.
- **[Dokploy](https://dokploy.com/)** — when a UI becomes useful (e.g., multi-developer team, designers wanting to ship without a CLI).
- **[Fly.io](https://fly.io/)** — multi-region, scale-to-zero. Different mental model.

---

## Open questions for kickoff

- **Registry:** GHCR (free, fits our existing GitHub-centric workflow) or DO Container Registry ($5/mo, faster pull on droplet because same datacenter). Default: GHCR.
- **Secrets:** Keep using GHA repo secrets via Kamal's `env: tags:` pattern, or move to 1Password/SSM. Default: GHA secrets for v1 — minimal change.
- **Caddy stays as front:** Confirmed default. Caddy → kamal-proxy → app. We don't lose static-asset serving or the caching layer.

---

## Sources

- [Kamal — Deploy web apps anywhere](https://kamal-deploy.org/)
- [Self-Hosted Deployment Tools Compared (2026) — Haloy](https://haloy.dev/blog/self-hosted-deployment-tools-compared)
- [Deploying with Kamal on AWS + Terraform — Pabluc](https://pabluc.medium.com/deploying-with-kamal-on-aws-ec2-ecr-and-cloudwatch-terraform-for-iasc-723ce666d661)
- [Terraform on DigitalOcean: Complete Guide (2026) — DevOpsTales](https://devopstales.com/tools-and-technologies/terraform-digitalocean-complete-guide-2026/)
- [Mkdev: A developer's take on Kamal](https://mkdev.me/posts/thoughts-on-kamal-30)
