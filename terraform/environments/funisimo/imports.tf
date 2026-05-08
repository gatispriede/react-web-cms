# Existing infra import blocks for funisimo.pro.
#
# IDs sourced from the DO API on 2026-05-08:
#   curl -H "Authorization: Bearer $DO_TOKEN" https://api.digitalocean.com/v2/droplets
#   curl -H "Authorization: Bearer $DO_TOKEN" https://api.digitalocean.com/v2/reserved_ips
#
# Out of scope (deliberately not imported — see modules/site/main.tf
# header for the reasoning):
#   - DO Cloud Firewall "Standard" (43a483e8-645a-4a9c-a60e-4f7e3a56ca6b)
#     — shared with another droplet, leave DO-managed.
#   - DNS — funisimo.pro is registered + zone-managed externally.

# ---------------------------------------------------------------- droplet

import {
  to = module.funisimo.digitalocean_droplet.app
  id = "565525068"
}

# ---------------------------------------------------------------- reserved IP

import {
  to = module.funisimo.digitalocean_reserved_ip.app
  id = "139.59.205.140"
}

import {
  to = module.funisimo.digitalocean_reserved_ip_assignment.app
  id = "139.59.205.140,565525068"
}
