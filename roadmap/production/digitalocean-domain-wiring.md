# Digital Ocean — domain + TLS wiring

## Goal

`gatispriede.com` (or the chosen apex) points at the Digital Ocean droplet running the CMS, over HTTPS with auto-renewing Let's Encrypt certs, `www` → apex redirect, and zero manual cert rotation.

Prerequisite: [automatic-deployment.md](automatic-deployment.md) is running. Don't wire a domain into a setup you can't redeploy reliably.

## Design

### DNS (Digital Ocean side)

- Add domain to DO → create `A` record for `@` pointing at the droplet's public IP
- `CNAME www` → `@`
- `TXT` records for any mail / verification needs (SPF if email ever sends from this box)
- TTL short (600s) during setup; bump to 3600 once stable

### Registrar side

- Point nameservers at DO: `ns1.digitalocean.com`, `ns2.digitalocean.com`, `ns3.digitalocean.com`
- Propagation window: up to 24 h worst case, usually under 1 h

### TLS — Caddy OR Traefik

Recommend **Caddy** — simpler, auto-HTTPS from a one-line `Caddyfile`:

```
gatispriede.com, www.gatispriede.com {
    redir https://gatispriede.com{uri}
    reverse_proxy app:3000
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

Caddy container is added to `compose.yaml`, owns ports 80/443, proxies to the existing `app` service on its internal port. Let's Encrypt certs live in a named volume so they persist across redeploys.

### Firewall (DO Cloud Firewall)

- Inbound: 80, 443 from anywhere; 22 from your IP only
- Outbound: all
- Block direct access to the app's internal port (3000) from the public interface — Caddy is the only entry point

### Health + redirect tests

- After DNS cutover, `curl -I https://gatispriede.com` returns 200 with `strict-transport-security`
- `curl -I http://gatispriede.com` → 301 to https
- `curl -I https://www.gatispriede.com` → 301 to apex
- SSL Labs rating ≥ A

## Files to touch

- `Caddyfile` (new, in repo root)
- `compose.yaml` — add `caddy:` service, `caddy_data` and `caddy_config` volumes
- Remove the app's port 3000 publication — only Caddy exposes ports
- `DEPLOY.md` — domain + DNS checklist, cert troubleshooting notes
- `.env.example` — add `SITE_DOMAIN` var (consumed by Caddyfile via env substitution if domain varies per env)

## Acceptance

- HTTPS works within 30 min of DNS propagation
- `http://` and `www.` both 301 to the canonical apex HTTPS URL
- Certs auto-renew (Caddy handles this; check logs after 60 days)
- SSL Labs scan ≥ A, no mixed-content warnings
- Droplet's port 3000 is not reachable from public internet
- DO Cloud Firewall active with the rules above

## Risks / notes

- `NEXTAUTH_URL` env var must change to the https URL — otherwise next-auth callbacks break on cookie flags
- Check sitemap + any absolute URLs in content for `http://` stragglers; `next-sitemap.config.cjs` needs `siteUrl` updated
- Don't rotate the domain mid-CI-rollout — cut over during a quiet window
- If CDN / Cloudflare is added later, disable Caddy's TLS in favour of Cloudflare's (or use "full strict")

## Effort

**S–M · 2–4 h** (plus DNS propagation wait)

- Caddy compose service + Caddyfile: 1 h
- DNS records + registrar nameserver switch: 30 min
- Test + firewall rules: 1 h
- Update `NEXTAUTH_URL` + `next-sitemap` config + redeploy: 30 min
- Verification (SSL Labs, curl redirects): 30 min
