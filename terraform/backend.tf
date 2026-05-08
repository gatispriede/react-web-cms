# State backend — Terraform Cloud free tier (Wave 1 spec choice).
#
# Free tier covers: 5 users, 500 resources, remote state + run UI. Our
# resource count per environment is ~5-7 (droplet, reserved IP, firewall,
# 3-4 DNS records); even with both tenants the total stays under 30.
#
# Operator setup: see `terraform/README.md` — sign in at app.terraform.io,
# create org + workspace, run `terraform login` locally to cache the auth
# token, then `terraform init` writes this config into `.terraform/`.

terraform {
  cloud {
    organization = "funisimo"

    workspaces {
      # Per-environment workspace — `funisimo-prod` for production, add
      # `funisimo-staging` when a staging environment surfaces. Keeps
      # state files cleanly separated and lets us run terraform against
      # one without touching the other.
      name = "funisimo-prod"
    }
  }
}
