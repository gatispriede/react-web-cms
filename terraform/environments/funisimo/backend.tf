# State backend.
#
# Test phase (current): local backend — `terraform.tfstate` in this
# directory, gitignored via `terraform/.gitignore`. Lets us run plan
# against live infra without provisioning the TF Cloud workspace yet.
#
# Production phase: switch to TF Cloud once the workspace is created.
# Replace the `backend "local" {}` block below with:
#
#     cloud {
#       organization = "funisimo"
#       workspaces { name = "funisimo-prod" }
#     }
#
# Then run `terraform init -migrate-state` to push the local state into
# TF Cloud. Local `terraform.tfstate` becomes read-only after migration.

terraform {
  backend "local" {}
}
