variable "do_token" {
  description = "DigitalOcean Personal Access Token. Set via TF Cloud workspace var or TF_VAR_do_token; never commit."
  type        = string
  sensitive   = true
}

variable "ssh_key_fingerprint" {
  description = "Fingerprint of the SSH key already added to your DO account (`doctl compute ssh-key list`). Used to authorise root access on freshly-provisioned droplets."
  type        = string
}

variable "region" {
  description = "DigitalOcean region slug — defaults to `fra1` (Frankfurt) which is where the existing droplets live. Change only when migrating to a new region."
  type        = string
  default     = "fra1"
}

variable "droplet_size" {
  description = "Default droplet size slug. `s-1vcpu-2gb` matches the current production sizing — bump if mongo + node + caddy start contending."
  type        = string
  default     = "s-1vcpu-2gb"
}

variable "droplet_image" {
  description = "Base image slug. `ubuntu-24-04-x64` matches the current droplets; the cattle-not-pets cutover assumes Docker is installed via cloud-init in the module."
  type        = string
  default     = "ubuntu-24-04-x64"
}
