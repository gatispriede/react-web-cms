# Terraform — DigitalOcean infra

Source of truth for the droplets, reserved IPs, firewalls, and DNS records that host the CMS production sites.

**Status:** funisimo.pro — import IDs filled (2026-05-08), pending `terraform plan` validation. skyclimber.pro — pending funisimo cutover stable.

**Out-of-scope (deliberate):**
- **DNS** — funisimo.pro is registered + DNS-managed at an external registrar. DO Domains only carries `legalstablesure.com`. Adding terraform-managed DNS would create a parallel zone with no authority.
- **Cloud Firewall** — the existing "Standard" firewall (id `43a483e8-…`) is shared between the funisimo droplet and one other DO droplet. Importing it into a per-tenant module would either drop the other droplet from its rules or force per-tenant drift. Stays DO-managed; on-droplet `ufw` (set up by cloud-init in the module for new droplets) provides defence in depth.

## Layout

```
terraform/
  providers.tf      # DO + Cloudflare provider config (no creds inline)
  variables.tf      # do_token, ssh_key_fingerprint, region, sizes
  backend.tf        # state backend config (Terraform Cloud free tier)
  modules/
    site/           # reusable per-tenant module (droplet + IP + firewall + DNS)
  environments/
    funisimo/       # `terraform/environments/funisimo` — funisimo.pro
      main.tf
      imports.tf    # `terraform import` blocks for existing resources
      terraform.tfvars.example
```

## First-time setup (operator)

1. Install Terraform ≥ 1.6 (`brew install terraform` / `choco install terraform`).
2. Sign up for [Terraform Cloud](https://app.terraform.io/) free tier; create org `funisimo` and workspace `funisimo-prod`.
3. Generate a DO Personal Access Token at https://cloud.digitalocean.com/account/api/tokens — read+write scopes.
4. In Terraform Cloud workspace → Variables, set:
   - `do_token` (sensitive)
   - `ssh_key_fingerprint` (the fingerprint of the public key already added to your DO account; `doctl compute ssh-key list`)
5. Locally:
   ```bash
   cd terraform/environments/funisimo
   cp terraform.tfvars.example terraform.tfvars  # fill in non-secret values
   terraform login                                # one-time TF Cloud auth
   terraform init
   ```

## Importing existing infra

Run `doctl` to gather IDs of resources already in DO, then fill `imports.tf`:

```bash
doctl compute droplet list --format ID,Name,PublicIPv4
doctl compute floating-ip list
doctl compute firewall list
doctl compute domain records list funisimo.pro
```

Stamp the IDs into the corresponding `import` blocks in `imports.tf`, then:

```bash
terraform plan
```

Acceptance gate: `terraform plan` reports **no changes** against live infra. If it wants to add/replace anything, the import blocks are wrong or the module is misconfigured — adjust, never apply against a non-empty diff.

## Day-to-day ops

See [`docs/runbooks/terraform.md`](../docs/runbooks/terraform.md) — provider login, common ops (`plan`, `apply`, `destroy`, `import`), state recovery.

## Cattle-not-pets

Per the migration spec, droplet state isn't sacred. If a droplet dies:

```bash
terraform destroy -target=module.funisimo.digitalocean_droplet.app
terraform apply -target=module.funisimo.digitalocean_droplet.app
# kamal setup           # provision the new droplet
# kamal deploy           # ship the latest image
# bundle import          # restore content from latest export
```

Total time: ~10 min from a freshly-`apply`-ed droplet to a serving site, assuming a recent bundle export is available in `/uploads/bundles/` of a workstation.
