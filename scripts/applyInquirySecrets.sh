#!/usr/bin/env bash
# Apply inquiry-form SMTP secrets to the funisimo.pro droplet.
#
# Re-uses the Resend API key + EMAIL_FROM that already live in the
# peaches (LegalStableSure) project's `.env` — peaches has the Resend
# domain `legalstablesure.com` verified, so we re-use that From address
# and the same API key for the funisimo.pro contact form too.
#
# The script never echoes the key to stdout, never writes it to any
# file under git, and never makes it visible to the running shell's
# `ps` listing. It just streams the values straight into a heredoc
# piped to `ssh` and lets the remote bash write them into the secret
# files. After the script exits there is no copy of the key anywhere
# except the original peaches .env and `/opt/cms/secrets/smtp_pass`
# on the droplet.
#
# Usage (funisimo droplet — root login is disabled, use the deploy user):
#   ./scripts/applyInquirySecrets.sh gatis@139.59.205.140
#
# Or a different droplet / user:
#   ./scripts/applyInquirySecrets.sh root@138.68.115.204     # skyclimber
#
# Custom peaches .env path:
#   PEACHES_ENV=/path/to/peaches/.env ./scripts/applyInquirySecrets.sh gatis@139.59.205.140

set -euo pipefail

DROPLET="${1:-}"
if [ -z "$DROPLET" ]; then
    echo "usage: $0 user@host"
    echo "  e.g. $0 root@funisimo.pro"
    exit 2
fi

PEACHES_ENV="${PEACHES_ENV:-D:/Work/Experiments/peaches/apps/api/.env}"
if [ ! -f "$PEACHES_ENV" ]; then
    echo "peaches .env not found at: $PEACHES_ENV" >&2
    echo "Set PEACHES_ENV to point at the right file." >&2
    exit 2
fi

# Extract values via awk so we don't end up with shell-quoted noise.
# `substr($0, length($1)+2)` grabs everything after the first `=`,
# preserving any `=` that may appear inside the value itself.
KEY=$(awk -F= '/^RESEND_API_KEY=/ {print substr($0, length($1)+2); exit}' "$PEACHES_ENV")
FROM=$(awk -F= '/^EMAIL_FROM=/    {print substr($0, length($1)+2); exit}' "$PEACHES_ENV")

# Strip surrounding quotes if .env has them (some teams quote, some don't).
KEY="${KEY%\"}";  KEY="${KEY#\"}";   KEY="${KEY%\'}";  KEY="${KEY#\'}"
FROM="${FROM%\"}"; FROM="${FROM#\"}"; FROM="${FROM%\'}"; FROM="${FROM#\'}"

if [ -z "$KEY" ]; then
    echo "RESEND_API_KEY not found in $PEACHES_ENV" >&2
    exit 1
fi
if [ -z "$FROM" ]; then
    # Peaches uses bare `noreply@legalstablesure.com` for EMAIL_FROM;
    # we wrap with a friendly display name so the recipient sees a
    # branded sender even though the address is the legalstablesure
    # one.
    FROM="noreply@legalstablesure.com"
fi
FRIENDLY_FROM="Funisimo Inquiry <${FROM}>"

echo "==> Applying SMTP secrets to ${DROPLET}"
echo "    host:  smtp.resend.com:465"
echo "    user:  resend"
echo "    pass:  re_*** (from peaches .env)"
echo "    from:  ${FRIENDLY_FROM}"
echo

# Pipe the contents straight into the remote shell — bash on the
# droplet expands the variables we splice in, writes the files, and
# never echoes them back. The local `set +x` (off) and the absence of
# any `printf` of the key keep it out of any local trace.
#
# Using `sudo -S bash` so the deploy user (e.g. `gatis` on the
# funisimo droplet, where root login is disabled) can still write to
# `/opt/cms/secrets/`. `-S` reads the password from stdin if needed,
# but for a passwordless-sudo deploy user the password prompt is
# skipped entirely. If you're SSH-ing in as root just remove the
# `sudo -S` prefix; root doesn't need it.
ssh -t "$DROPLET" sudo -S bash <<EOF
set -euo pipefail
cd /opt/cms
mkdir -p secrets
chmod 700 secrets

# printf '%s' avoids the trailing newline that 'echo' adds — SMTP
# servers reject auth strings with embedded \n.
printf '%s' 'smtp.resend.com'        > secrets/smtp_host
printf '%s' '465'                    > secrets/smtp_port
printf '%s' 'resend'                 > secrets/smtp_user
printf '%s' '${KEY}'                 > secrets/smtp_pass
printf '%s' '${FRIENDLY_FROM}'       > secrets/mail_from
chmod 600 secrets/*

echo "==> Files written:"
ls -la secrets/
echo
echo "==> Sizes (sanity-check):"
wc -c secrets/* | awk '{print \$1, \$2}'
EOF

echo
echo "Done. The transporter cache invalidates automatically on the next"
echo "request, so submit a brief at https://funisimo.pro/contact and"
echo "watch the admin Inquiries tab — the new row should land green."
