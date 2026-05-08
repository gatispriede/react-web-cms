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
  description = "Fingerprint of the SSH key authorised on the droplet."
  type        = string
}

module "funisimo" {
  source = "../../modules/site"

  name                = "funisimo"
  domain              = "funisimo.pro"
  region              = "fra1"
  size                = "s-1vcpu-2gb"
  image               = "ubuntu-24-04-x64"
  ssh_key_fingerprint = var.ssh_key_fingerprint
}

output "funisimo_ip" {
  value = module.funisimo.ipv4_address
}

output "funisimo_droplet_id" {
  value = module.funisimo.droplet_id
}
