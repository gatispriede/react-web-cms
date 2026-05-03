# MongoDB authentication — setup, rotation, recovery

P5 of the production-ops roadmap. Adds username/password auth to the
production Mongo container. Dev (`compose.dev.yaml`) is unchanged —
the unauthenticated path is preserved when `MONGO_USER`/`MONGO_PASS`
are unset, so `npm run dev` keeps working with no env changes.

## Concepts

- **Root user** — owns the Mongo cluster. Used only by the bootstrap
  script and by ops for one-off recovery. `MONGO_INITDB_ROOT_USERNAME`
  + `MONGO_INITDB_ROOT_PASSWORD` are read by the official Mongo image
  on first boot against an empty data dir; they enable `--auth` and
  seed the user automatically.
- **App user** — `cms` by default. Has `readWrite` + `dbAdmin` on the
  application database (`MAIN-DB`) and nothing else. The app boots
  with `MONGO_USER=cms` / `MONGO_PASS=…`; the connection string is
  composed by `services/infra/mongoConfig.ts → buildMongoUri()`.

## First-time setup (cold droplet)

```bash
cd /opt/cms
git pull
sudo mkdir -p secrets && sudo chmod 700 secrets

# Mongo must be up but the app should NOT be (the app would refuse to
# boot if it tried to auth against a not-yet-created user).
docker compose -f infra/compose.yaml up -d mongodb

# Generate root + app credentials, write them to a 0600 file.
sudo bash tools/mongo-bootstrap.sh

# Inspect the file (only root can read it).
sudo cat secrets/mongo-bootstrap.env

# Append the relevant lines into /opt/cms/.env:
#   MONGO_INITDB_ROOT_USERNAME / PASSWORD  (Mongo container reads these)
#   MONGO_USER / MONGO_PASS / MONGO_AUTH_SOURCE  (the app reads these)
sudo $EDITOR /opt/cms/.env

# Restart Mongo so it re-reads the root credentials, then bring up the
# app with the new MONGO_USER/PASS.
docker compose -f infra/compose.yaml up -d
```

Verify:

```bash
docker exec mongodb mongosh \
    "mongodb://cms:<APP_PASS>@mongodb:27017/MAIN-DB?authSource=admin" \
    --quiet --eval 'db.runCommand({ping:1}).ok'   # → 1
docker exec mongodb mongosh "mongodb://mongodb:27017/" \
    --quiet --eval 'db.runCommand({ping:1}).ok'   # → throws "requires authentication"
```

## Rotating the app password

```bash
sudo MONGO_APP_PASS="$(openssl rand -base64 32 | tr -d '/+=\n' | cut -c1-32)" \
    bash tools/mongo-bootstrap.sh
# → updates Mongo + writes a new secrets/mongo-bootstrap.env
sudo $EDITOR /opt/cms/.env       # update MONGO_PASS + MONGODB_URI
docker compose -f infra/compose.yaml up -d --no-deps app server
```

Caveat: between the password change and the app restart, the still-
running app will keep working on the existing pooled connections;
new connections will fail. Rolling restart is recommended (max ~30s
maintenance-page window).

## Recovery — locked out

If the root password is lost AND the app password is lost:

1. `docker compose -f infra/compose.yaml stop`
2. Edit `infra/compose.yaml` and temporarily comment out the two
   `MONGO_INITDB_ROOT_*` env lines.
3. `docker compose -f infra/compose.yaml up -d mongodb` — Mongo will
   refuse to start with `--auth` if the data dir already has users
   and you've removed the env. Workaround: drop into the container
   (`docker exec -it mongodb bash`) and start mongod manually with
   `--noauth` against the same data dir, then create a fresh root
   user via `mongosh`.
4. Restore the env block, `docker compose up -d` to re-enable auth.

The data is never lost — auth state is metadata, not user data.

## Why this design

- **Unauth dev path preserved** — flipping production to auth would
  otherwise break `npm run dev` for everyone.
- **Container reads the same env file as the app** — one secret store
  to rotate, no drift between Mongo's view and the app's view.
- **Bootstrap script writes to file when piped** — safe to run via
  `ssh droplet 'bash -s' < tools/mongo-bootstrap.sh` without leaking
  the password into the SSH session log.
