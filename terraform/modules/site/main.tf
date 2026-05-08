# Reusable per-tenant module — one droplet + reserved IP + firewall +
# DNS records. Both funisimo and skyclimber instantiate this module with
# tenant-specific values (domain, hostnames, sizes). Adding a third
# tenant is one `module "thirdsite"` block in the environment file.

terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.43"
    }
  }
}

variable "name" {
  description = "Tenant slug — used as droplet name + DNS comments + tag. e.g. `funisimo`."
  type        = string
}

variable "domain" {
  description = "Apex domain — e.g. `funisimo.pro`. Must already be registered + delegated to DO nameservers."
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

# ---------------------------------------------------------------- droplet

resource "digitalocean_droplet" "app" {
  name      = var.name
  region    = var.region
  size      = var.size
  image     = var.image
  ssh_keys  = [var.ssh_key_fingerprint]
  tags      = ["cms", var.name]
  ipv6      = false
  monitoring = true

  # cloud-init bootstrap — Docker + docker-compose-plugin so a freshly-
  # provisioned droplet can run `kamal setup` immediately. Reuses the
  # exact apt steps the legacy bash deploy used to run inline; moving
  # them into cloud-init means each droplet boot starts from a known
  # state instead of accreting drift.
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
      # ufw — allow ssh (22), http (80), https (443) only. The legacy
      # bash deploy script hardened sshd with MaxStartups + fail2ban; we
      # keep the same posture here so a fresh droplet matches the
      # hardened production state out of the box.
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

# ---------------------------------------------------------------- firewall

resource "digitalocean_firewall" "app" {
  name = "${var.name}-cms"

  droplet_ids = [digitalocean_droplet.app.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# ---------------------------------------------------------------- DNS

resource "digitalocean_domain" "app" {
  name = var.domain
}

resource "digitalocean_record" "apex" {
  domain = digitalocean_domain.app.name
  type   = "A"
  name   = "@"
  value  = digitalocean_reserved_ip.app.ip_address
  ttl    = 300
}

resource "digitalocean_record" "www" {
  domain = digitalocean_domain.app.name
  type   = "A"
  name   = "www"
  value  = digitalocean_reserved_ip.app.ip_address
  ttl    = 300
}

# ---------------------------------------------------------------- outputs

output "droplet_id" {
  value = digitalocean_droplet.app.id
}

output "ipv4_address" {
  value = digitalocean_reserved_ip.app.ip_address
}

output "domain" {
  value = digitalocean_domain.app.name
}
