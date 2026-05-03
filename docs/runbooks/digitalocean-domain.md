# Digital Ocean — domain + TLS wiring

P3 of the production-ops roadmap. Points a real domain at the droplet
and gets HTTPS via Let's Encrypt without any manual cert handling.

The production domain is **env-driven**, not hardcoded. The Caddyfile
reads `${DOMAIN}` and `${SITE_DOMAIN_WWW}` from `.env`; the same image
serves any number of sites by changing the env vars.

## DNS

In the DO control panel under **Networking → Domains**:

1. Add the apex domain (e.g. `example.com`).
2. `A` record `@` → droplet's public IPv4. TTL 600 during cutover,
   bump to 3600 once stable.
3. `AAAA` record `@` → droplet's public IPv6 (only if the droplet
   has one and you want IPv6).
4. `CNAME www` → `@`. (Caddy will 301 it to the apex automatically.)

At the registrar, point nameservers at:

```
ns1.digitalocean.com
ns2.digitalocean.com
ns3.digitalocean.com
```

Propagation is usually under 1 hour, occasionally up to 24 h.

Verify before continuing:

```bash
dig +short example.com         # → droplet IP
dig +short www.example.com     # → example.com → droplet IP
```

## DO Cloud Firewall

Inbound:

| Port | Source        | Why                               |
|------|---------------|-----------------------------------|
| 22   | Your IP only  | SSH                               |
| 80   | Anywhere      | HTTP → Caddy 301s to HTTPS        |
| 443  | Anywhere TCP  | HTTPS                             |
| 443  | Anywhere UDP  | HTTP/3 (already published)        |

Outbound: all (Mongo init / npm install / Let's Encrypt callbacks).

The Mongo `27017` port is **never** publishable — `compose.yaml`
intentionally omits a `ports:` mapping for it; the Cloud Firewall is
the second line of defence.

## Caddy auto-HTTPS

Set in `/opt/cms/.env`:

```
DOMAIN=example.com
SITE_DOMAIN_WWW=www.example.com
NEXTAUTH_URL=https://example.com
```

Then:

```bash
docker compose -f infra/compose.yaml up -d caddy
docker logs -f caddy   # watch for "certificate obtained successfully"
```

First-cert acquisition takes ~10 seconds. The cert is cached in the
`caddy_data` named volume, so subsequent restarts are instant. Renewal
runs automatically at ~30 days before expiry; nothing to schedule.

## Verification

```bash
curl -I https://example.com
# → HTTP/2 200, strict-transport-security header present
curl -I http://example.com
# → 308 Permanent Redirect → https://
curl -I https://www.example.com
# → 301 Moved Permanently → https://example.com/
```

SSL Labs scan target: rating ≥ A, no mixed-content warnings.

## Renewal monitoring

Caddy renews silently. To detect a stuck renewal early, set up a tiny
alarm — `curl -fsS --max-time 5 https://example.com >/dev/null` from
an external uptime monitor. If renewal failed Caddy will keep serving
the previous cert until expiry; you have ~30 days to react.

To inspect cert state:

```bash
docker exec caddy caddy list-certificates
```

## Troubleshooting

- **`unable to obtain certificate`** — usually port 80 is firewalled.
  Let's Encrypt's HTTP-01 challenge runs against `:80`. Check the DO
  firewall + that no other process is bound to `:80` on the droplet.
- **`too many certificates already issued`** — Let's Encrypt rate-
  limit (50/week per domain). Caddy retries with backoff; if you're
  bouncing the container repeatedly during testing, set `DOMAIN=:80`
  to drop to plain HTTP and resume staging cert acquisition later.
- **`NEXTAUTH_URL` mismatch** — Google OAuth callbacks fail with
  `redirect_uri_mismatch` if the env still says `http://`. Update
  `.env` and the Google Cloud Console authorized URIs.
