# MongoDB authentication

Add a password to the MongoDB instance on the production droplet and update the connection string.

## What to do

1. Create a MongoDB user with password in `mongosh`:
   ```js
   use admin
   db.createUser({user: 'cms', pwd: '<strong-password>', roles: [{role: 'readWrite', db: 'MAIN-DB'}]})
   ```
2. Enable auth in the MongoDB Docker service — add `--auth` to the command or set `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD` in `compose.yaml`.
3. Update `/opt/cms/.env` on the droplet:
   ```
   MONGODB_URI=mongodb://cms:<password>@mongodb:27017/MAIN-DB
   ```
4. Restart containers: `docker compose up -d`.

## Why
Currently MongoDB runs without authentication inside the Docker network. Low risk while port 27017 is not exposed publicly, but should be hardened before any public traffic or shared-droplet scenario.
