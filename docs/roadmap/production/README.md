# Production / ops roadmap

Items that affect how the CMS is **deployed, secured, or operated** in production. Split from feature / UX work so the two streams can be scheduled independently.

These are intentionally paused until the feature/UX surface stabilises — picking them up too early means re-doing them when surrounding code shifts.

## Contents

| # | Item | Status | Size |
|---|------|--------|------|
| 1 | [first-boot-admin-password.md](first-boot-admin-password.md) | **Shipped** (see git log) | M |
| 2 | [automatic-deployment.md](automatic-deployment.md) | **Shipped** — see `docs/runbooks/automatic-deployment.md` (gated on `vars.DEPLOY_ENABLED`) | L |
| 3 | [digitalocean-domain-wiring.md](digitalocean-domain-wiring.md) | **Shipped** — see `docs/runbooks/digitalocean-domain.md` (env-driven domain) | S–M |
| 4 | [seamless-deployment.md](seamless-deployment.md) | Planned (depends on P2) | S |
| 5 | [mongodb-auth.md](mongodb-auth.md) | **Shipped** — see `docs/runbooks/mongo-auth-setup.md` (dev path preserved when env unset) | XS |

Suggested ordering when picked up: 1 → 2 → 4 → 3 → 5. Items 2 and 4 are closely related (CI pipeline); tackle them together.

## Rough budget

- First-boot admin password: **done**
- Automatic deployment: 2–3 days
- Seamless deployment (zero-downtime): 2–3 h
- DO domain wiring: 2–4 h + DNS propagation wait
- MongoDB auth: ~1 h

Total remaining: ~3 engineering days plus DNS wait.
