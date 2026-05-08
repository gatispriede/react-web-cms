# Existing infra import blocks — fill these with real DO IDs before
# the first `terraform plan`. The acceptance gate is `terraform plan`
# returning **no changes** against live infra; if anything wants to
# replace, the IDs are wrong or the module config doesn't match.
#
# Gather IDs:
#
#   doctl compute droplet list --format ID,Name,PublicIPv4,Region,Size,Image
#   doctl compute floating-ip list
#   doctl compute firewall list
#   doctl compute domain records list funisimo.pro --format ID,Type,Name,Data,TTL
#
# Each `import` block points an existing live resource at the in-Terraform
# resource address it should bind to. After all the IDs are stamped:
#
#   terraform plan   # shows the diff; iterate until it's empty
#   terraform apply  # if (and only if) the plan is "no changes"
#
# ---------------------------------------------------------------- droplet

# import {
#   to = module.funisimo.digitalocean_droplet.app
#   id = "REPLACE_WITH_DROPLET_ID"
# }

# ---------------------------------------------------------------- reserved IP

# Reserved IPs are imported by the IP address itself (not a numeric ID).
# import {
#   to = module.funisimo.digitalocean_reserved_ip.app
#   id = "REPLACE_WITH_IPV4_ADDRESS"
# }

# Reserved IP assignment — composite ID `<ip>,<droplet_id>`.
# import {
#   to = module.funisimo.digitalocean_reserved_ip_assignment.app
#   id = "REPLACE_WITH_IPV4_ADDRESS,REPLACE_WITH_DROPLET_ID"
# }

# ---------------------------------------------------------------- firewall

# import {
#   to = module.funisimo.digitalocean_firewall.app
#   id = "REPLACE_WITH_FIREWALL_ID"
# }

# ---------------------------------------------------------------- DNS

# Domain — imported by the domain name itself.
# import {
#   to = module.funisimo.digitalocean_domain.app
#   id = "funisimo.pro"
# }

# Records — composite ID `<domain>,<record_id>`. List records via
# `doctl compute domain records list funisimo.pro` to get the IDs.
# import {
#   to = module.funisimo.digitalocean_record.apex
#   id = "funisimo.pro,REPLACE_WITH_APEX_RECORD_ID"
# }

# import {
#   to = module.funisimo.digitalocean_record.www
#   id = "funisimo.pro,REPLACE_WITH_WWW_RECORD_ID"
# }
