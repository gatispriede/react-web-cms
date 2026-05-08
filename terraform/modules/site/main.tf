# Reusable per-tenant module — droplet + reserved IP only.
#
# Scope decisions (post-API audit, 2026-05-08):
#   - DNS is OUT OF SCOPE — funisimo.pro is registered + DNS-managed at
#     an external registrar (DO only manages `legalstablesure.com`).
#     Adding a `digitalocean_domain` here would create a parallel zone
#     that nothing's authoritative for.
#   - Firewall is OUT OF SCOPE — the existing "Standard" DO Cloud
#     Firewall (id 43a483e8-…) is shared between both droplets. Importing
#     it into a per-tenant module would either drop the other droplet
#     from the rule set or force per-tenant drift. Leave as DO-managed.
#
# What stays:
#   - Droplet (the actual VM)
#   - Reserved IP + assignment (so cattle-not-pets rebuild keeps the IP)

terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.43"
    }
  }
}

variable "name" {
  description = "Tenant slug — used as droplet name + tag. e.g. `funisimo`."
  type        = string
}

variable "region" {
  description = "DO region slug for the droplet."
  type        = string
}

variable "size" {
  description = "DO droplet size slug."
  type        = string
}

variable "image" {
  description = "Base image slug."
  type        = string
}

variable "ssh_key_fingerprint" {
  description = "Fingerprint of the SSH key authorised on the droplet."
  type        = string
}

variable "tags" {
  description = "DO tags applied to the droplet. Defaults to [\"cms\"] which matches the existing funisimo droplet."
  type        = list(string)
  default     = ["cms"]
}

# ---------------------------------------------------------------- droplet

resource "digitalocean_droplet" "app" {
  name       = var.name
  region     = var.region
  size       = var.size
  image      = var.image
  ssh_keys   = [var.ssh_key_fingerprint]
  tags       = var.tags
  ipv6       = true
  monitoring = true

  # cloud-init bootstrap — Docker + ufw + fail2ban so a freshly-
  # provisioned droplet can run `kamal setup` immediately. Mirrors the
  # apt steps the legacy bash deploy used to run inline; moving them
  # into cloud-init means each droplet boot starts from a known state
  # instead of accreting drift across deploys.
  user_data = <<-EOT
    #cloud-config
    package_update: true
    package_upgrade: true
    packages:
      - ca-certificates
      - curl
      - gnupg
      - ufw
      - fail2ban
    runcmd:
      - install -m 0755 -d /etc/apt/keyrings
      - curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      - chmod a+r /etc/apt/keyrings/docker.gpg
      - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
      - apt-get update
      - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      - systemctl enable docker
      - systemctl start docker
      - mkdir -p /opt/cms/uploads /srv/uploads
      - chown -R 1000:1000 /opt/cms/uploads
      - ufw default deny incoming
      - ufw default allow outgoing
      - ufw allow 22/tcp
      - ufw allow 80/tcp
      - ufw allow 443/tcp
      - ufw --force enable
      - systemctl enable fail2ban
      - systemctl start fail2ban
  EOT
}

# ---------------------------------------------------------------- reserved IP

resource "digitalocean_reserved_ip" "app" {
  region = var.region
}

resource "digitalocean_reserved_ip_assignment" "app" {
  ip_address = digitalocean_reserved_ip.app.ip_address
  droplet_id = digitalocean_droplet.app.id
}

# ---------------------------------------------------------------- outputs

output "droplet_id" {
  value = digitalocean_droplet.app.id
}

output "ipv4_address" {
  value = digitalocean_reserved_ip.app.ip_address
}

output "droplet_public_ipv4" {
  value = digitalocean_droplet.app.ipv4_address
}
