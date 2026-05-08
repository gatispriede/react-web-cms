# funisimo.pro — production environment.
#
# This file wires the reusable `modules/site` module with funisimo's
# domain + size. State lives in the `funisimo-prod` workspace declared
# in `../../backend.tf`.
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
  description = "DigitalOcean PAT — set via TF Cloud workspace var."
  type        = string
  sensitive   = true
}

variable "ssh_key_fingerprint" {
  description = "Fingerprint of the SSH key authorised on the droplet. Set via TF Cloud workspace var (preferred) or local terraform.tfvars (gitignored). Marked sensitive so terraform plan/apply don't print it to logs."
  type        = string
  sensitive   = true
}

module "funisimo" {
  source = "../../modules/site"

  # `name` matches the existing droplet's `name` field on DO so that
  # `terraform plan` after import returns "no changes". Live droplet
  # name is `my-homepage` (set 2026-04-17, predates the funisimo
  # branding); rename via `digitalocean_droplet.app.name = "funisimo"`
  # is a separate post-import housekeeping step.
  name                = "my-homepage"
  region              = "fra1"
  size                = "s-1vcpu-2gb"
  image               = "ubuntu-24-04-x64"
  ssh_key_fingerprint = var.ssh_key_fingerprint
  tags                = ["cms"]
}

output "funisimo_reserved_ip" {
  value       = module.funisimo.ipv4_address
  description = "Reserved IPv4 — DNS apex points here (`139.59.205.140`)."
}

output "funisimo_droplet_public_ipv4" {
  value       = module.funisimo.droplet_public_ipv4
  description = "Droplet's eth0 public IP — diagnostic only; clients reach the site via the reserved IP."
}

output "funisimo_droplet_id" {
  value = module.funisimo.droplet_id
}
