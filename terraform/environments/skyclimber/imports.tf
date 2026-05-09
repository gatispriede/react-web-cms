# Existing infra import blocks for skyclimber.pro.
#
# IDs sourced from the DO API on 2026-05-09:
#   curl -H "Authorization: Bearer $DO_TOKEN_SKY" \
#     https://api.digitalocean.com/v2/droplets
#   curl -H "Authorization: Bearer $DO_TOKEN_SKY" \
#     https://api.digitalocean.com/v2/reserved_ips
#
# Out of scope (deliberately not imported — see modules/site/main.tf
# header for the funisimo equivalents):
#   - Cloud Firewall — skyclimber's account has no firewall configured
#     (the droplet's only one on this account; on-droplet ufw + fail2ban
#     suffice). If a firewall surfaces later, import then.
#   - DNS — skyclimber.pro is registered + zone-managed externally.

# ---------------------------------------------------------------- droplet

import {
  to = module.skyclimber.digitalocean_droplet.app
  id = "566227987"
}

# ---------------------------------------------------------------- reserved IP

import {
  to = module.skyclimber.digitalocean_reserved_ip.app
  id = "138.68.115.204"
}
