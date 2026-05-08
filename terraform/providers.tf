# DigitalOcean provider — all CMS production infra lives here.
#
# `cloudflare` provider stub is included but commented out; current DNS is
# served by DO domains. Uncomment + configure when migrating DNS to
# Cloudflare (planned only if a CDN / WAF requirement appears).

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.43"
    }
    # cloudflare = {
    #   source  = "cloudflare/cloudflare"
    #   version = "~> 4.30"
    # }
  }
}

provider "digitalocean" {
  # `do_token` is sensitive — set via Terraform Cloud workspace var or
  # `TF_VAR_do_token` env locally. Never commit it.
  token = var.do_token
}
