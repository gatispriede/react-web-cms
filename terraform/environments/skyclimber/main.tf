# skyclimber.pro — production environment.
#
# Mirror of `terraform/environments/funisimo/` with skyclimber-specific
# overrides. The reusable `modules/site` module covers droplet + reserved
# IP only — DNS lives at an external registrar (same as funisimo); no DO
# Cloud Firewall on this account (skyclimber's the only droplet, so no
# shared-firewall coordination needed).
#
# Run from this directory:
#   terraform init    # one-time
#   terraform plan    # against live infra (after imports.tf is filled)
#   terraform apply   # only after plan returns "no changes"

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.43"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

variable "do_token" {
  description = "DigitalOcean PAT for skyclimber's account (alpinistsaugstuma@gmail.com / My Team) — set via TF Cloud workspace var."
  type        = string
  sensitive   = true
}

variable "ssh_key_fingerprint" {
  description = "Fingerprint of the SSH key authorised on the droplet. Set via TF Cloud workspace var (preferred) or local terraform.tfvars (gitignored). Marked sensitive so terraform plan/apply don't print it to logs."
  type        = string
  sensitive   = true
}

module "skyclimber" {
  source = "../../modules/site"

  # `name` matches the existing droplet's `name` field on DO so that
  # `terraform plan` after import returns "no changes". Live droplet
  # name is `SkyClimber-sia` — preserve as-is.
  name                = "SkyClimber-sia"
  region              = "fra1"
  size                = "s-2vcpu-4gb"   # bigger than funisimo (1 vCPU/2 GB)
  image               = "ubuntu-24-04-x64"
  ssh_key_fingerprint = var.ssh_key_fingerprint
  tags                = []   # skyclimber droplet has no tags currently
}

output "skyclimber_reserved_ip" {
  value       = module.skyclimber.ipv4_address
  description = "Reserved IPv4 — DNS apex points here (`138.68.115.204`)."
}

output "skyclimber_droplet_public_ipv4" {
  value       = module.skyclimber.droplet_public_ipv4
  description = "Droplet's eth0 public IP — diagnostic only; clients reach the site via the reserved IP."
}

output "skyclimber_droplet_id" {
  value = module.skyclimber.droplet_id
}
