# Terraform — provider setup, common ops, state recovery

Source-of-truth for the DigitalOcean droplets, reserved IPs, firewalls, and DNS records under `terraform/`. Wave 1 (Terraform/Kamal migration) is the first time the production infra has a declarative reflection — before this, the droplets were hand-crafted in the DO console and the only "spec" was institutional knowledge.

**Status:** funisimo.pro scaffolded, not imported yet. skyclimber pending funisimo cutover stable.

## Setup

### 1. Install

```bash
brew install terraform   # macOS
choco install terraform  # Windows
# or download from https://developer.hashicorp.com/terraform/downloads
```

Need ≥ 1.6.0 — the project uses the `terraform { cloud {} }` block + import blocks, both of which are post-1.5 features.

### 2. Terraform Cloud (state backend)

The state file lives in [Terraform Cloud](https://app.terraform.io/) on the free tier (5 users, 500 resources — we'll never hit either limit). Reasoning: state needs concurrency control + a remote store, and TF Cloud's free tier solves both without provisioning S3/Spaces buckets that themselves need terraforming.

Setup once:

1. Sign up at app.terraform.io.
2. Create org `funisimo`.
3. Create workspace `funisimo-prod` (CLI-driven — pick "CLI-driven workflow" not "VCS-connected").
4. Generate a workspace-scoped variable for `do_token` (mark sensitive).
5. Locally:
   ```bash
   terraform login   # caches a TF Cloud auth token in ~/.terraform.d/credentials.tfrc.json
   ```

### 3. Local

```bash
cd terraform/environments/funisimo
cp terraform.tfvars.example terraform.tfvars   # fill in non-secret values (ssh fingerprint)
terraform init                                 # downloads providers, configures TF Cloud backend
```

## Importing existing infra

The acceptance gate for the migration is **`terraform plan` returns "no changes"** against live infra. To get there:

```bash
# 1. Gather IDs
doctl compute droplet list --format ID,Name,PublicIPv4,Region,Size,Image
doctl compute floating-ip list
doctl compute firewall list
doctl compute domain records list funisimo.pro --format ID,Type,Name,Data,TTL

# 2. Stamp into terraform/environments/funisimo/imports.tf
#    (uncomment each block, replace REPLACE_WITH_* with the real IDs)

# 3. Plan
terraform plan
```

**If `plan` shows changes** — the import IDs or the module config don't reflect reality. Common causes:

- Droplet size or image differs from the module default → adjust `module.funisimo`'s args
- DNS record TTL differs (DO defaults to 1800; we hard-code 300) → either accept the diff or update the module
- Firewall rules differ → align the module to match the live ruleset

**Never run `terraform apply` against a non-empty diff during import.** That replaces live resources with the module's interpretation, which can mean a destroyed droplet.

## Common ops

| Goal | Command |
|------|---------|
| See pending changes | `terraform plan` |
| Apply pending changes | `terraform apply` |
| Show current state | `terraform show` |
| List all resources | `terraform state list` |
| Drift-check (no changes) | `terraform plan` returns "no changes" |
| Recreate one droplet | `terraform taint module.funisimo.digitalocean_droplet.app && terraform apply` |
| Destroy + rebuild a tenant | `terraform destroy -target=module.funisimo && terraform apply` |
| One-off resource removal | `terraform state rm <addr>` (removes from state, doesn't destroy) |

## State recovery

### "Lost" the state file

If TF Cloud is down or the workspace is misconfigured, you can recover:

```bash
# Pull the most recent state from TF Cloud
terraform state pull > backup.tfstate

# If TF Cloud itself is unrecoverable (very rare) — re-import from scratch
# using the imports.tf flow above.
```

### Drift between state and live infra

Run `terraform refresh` to re-sync state from the live infra without changing anything. Then `terraform plan` shows the diff between the new state and the desired config — fix the config to match what's live, or apply to bring live back to spec.

## Cattle-not-pets — provisioning a fresh droplet

The Wave 1 spec's acceptance criterion #8 (cattle test) requires we can `terraform destroy` + `terraform apply` and end up with a serving droplet within 10 min:

```bash
cd terraform/environments/funisimo
terraform destroy -target=module.funisimo.digitalocean_droplet.app
terraform apply -target=module.funisimo.digitalocean_droplet.app

# cloud-init in the droplet's user_data installs Docker + ufw + fail2ban
# automatically. Wait ~2 min for cloud-init to finish:
ssh root@$(terraform output -raw funisimo_ip) -- 'cloud-init status --wait'

# Then ship the latest image via Kamal:
kamal setup
kamal deploy

# Restore content:
scp /path/to/latest-bundle.zip root@$(terraform output -raw funisimo_ip):/srv/uploads/bundles/
ssh root@$(terraform output -raw funisimo_ip) -- 'docker exec cms-app node tools/bundle-import.js /srv/uploads/bundles/latest-bundle.zip'
```

Total wall-clock: ~10 min from `apply` to a serving site, given a recent bundle export available locally.

## Adding a new tenant

```hcl
# terraform/environments/<newsite>/main.tf — copy from funisimo/, change:
#   module.<newsite>.name   = "newsite"
#   module.<newsite>.domain = "newsite.example.com"
# Then:
terraform init
terraform apply
```

The `modules/site` module is intentionally tenant-agnostic — every resource is parameterised by `var.name` / `var.domain` so adding a third tenant is one module instantiation, not a fork of the configs.

## Related

- [`docs/runbooks/kamal-deploy.md`](kamal-deploy.md) — once the droplet exists, this is how you ship app code to it.
- [`docs/runbooks/ghcr.md`](ghcr.md) — image build + push pipeline that Kamal pulls from.
- [`terraform/README.md`](../../terraform/README.md) — file-level layout of the terraform directory.
