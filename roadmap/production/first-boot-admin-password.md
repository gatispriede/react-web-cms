# First-boot admin password — generate + surface

## Goal

Kill `ADMIN_DEFAULT_PASSWORD` as the production seed path. On first `setupAdmin` when neither `ADMIN_DEFAULT_PASSWORD` nor `ADMIN_PASSWORD_HASH` is set, the system generates a strong unique password, writes it to a protected artefact once, and nags the admin to rotate it on first login.

## Design

### Generation

- 24-char URL-safe random (`crypto.randomBytes(18).toString('base64url')`).
- Bcrypt-hash immediately; plain value never re-read from disk.

### Surfacing (priority order)

1. If `process.stdout.isTTY` (interactive boot): print a high-visibility banner
   ```
   ════════════════════════════════════════════════════
    INITIAL ADMIN PASSWORD = <value>
    Change on first login. This banner will not repeat.
   ════════════════════════════════════════════════════
   ```
2. Always: write `var/admin-initial-password.txt` with mode `0600`, content = single line, no trailing newline.
   - Directory created with `0700`.
   - Guarded by `fs.existsSync` → fail-loud instead of overwriting.
3. Never: write to `stdout` when not a TTY (prevents capture into container log shippers). Never write to the app log file.

### User-doc flag

- Stamp the seeded user with `mustChangePassword: true`.
- `UserStatusBar` renders a persistent red banner while the flag is set: "Change your password — you're using the seeded default."
- `updateUser` with a new `password` clears the flag.

### Regeneration safety

- If `var/admin-initial-password.txt` exists on boot but the admin user was deleted, `setupAdmin` fails loud (exits non-zero, prints "Found stale initial-password artefact at …, but no admin user exists. Remove the file manually after confirming you have no use for it.") — never silently re-seeds a different password.

## Files to touch

- `src/Server/mongoDBConnection.ts::setupAdmin` — branch on env vars, call new `generateInitialPassword()` helper
- `src/Server/initialPassword.ts` (new) — generation + artefact write + banner
- `src/Interfaces/IUser.ts` — `mustChangePassword?: boolean`
- `UserService.addUser` — carry flag; `updateUser` — clear flag on password change
- `src/frontend/components/common/UserStatusBar.tsx` — banner when flag is set
- `DEPLOY.md` — document the flow next to the MongoDB section
- `.gitignore` — ensure `var/` is ignored
- `Dockerfile` (App + Server) — create `/app/var` with `0700` in the runtime image

## Acceptance

- Boot in Docker with no `ADMIN_*` env: the password file appears in `var/` inside the container with `0600`; banner prints exactly once to stdout if TTY; login works with that password
- Second boot: no new password generated, no banner, file unchanged
- First login nags with a banner; rotating the password clears it persistently
- Deleting the admin user and rebooting: server refuses to start with a clear message
- `ADMIN_PASSWORD_HASH` set → bypass entirely, no file, no banner

## Risks / notes

- Container log shippers will grab stdout — that's why the TTY gate matters. Document it.
- File path must be writable by the Node process user; `0600` root-owned won't work if the container runs as `node`.
- On Windows dev boxes, mode bits are advisory. Don't guard the dev flow on them — just log a warning.

## Effort

**M · 4–6 h**

- Generator + artefact write + banner: 1.5 h
- `mustChangePassword` flag + UI banner: 1–2 h
- `setupAdmin` branching + stale-file guard: 1 h
- Dockerfile + docs: 30 min – 1 h
- Boot test + rotation test: 30 min
