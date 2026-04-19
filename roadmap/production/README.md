# Production / ops roadmap

Items that affect how the CMS is **deployed, secured, or operated** in production. Split from feature / UX work so the two streams can be scheduled independently.

These are intentionally paused until the feature/UX surface stabilises — picking them up too early means re-doing them when surrounding code shifts.

## Contents

| # | Item | Status | Size |
|---|------|--------|------|
| 1 | [first-boot-admin-password.md](first-boot-admin-password.md) | **Shipped** (see git log) | M |
| 2 | [automatic-deployment.md](automatic-deployment.md) | Planned | L |
| 3 | [digitalocean-domain-wiring.md](digitalocean-domain-wiring.md) | Planned | S–M |

Suggested ordering when picked up: 1 → 2 → 3. Each depends on the one above.

## Rough budget

- First-boot admin password: **done**
- Automatic deployment: 2–3 days
- DO domain wiring: 2–4 h + DNS propagation wait

Total remaining: ~2.5 engineering days plus DNS wait.
