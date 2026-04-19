import crypto from 'crypto';
import fs from 'fs';
import path from 'node:path';

const VAR_DIR = path.join(process.cwd(), 'var');
export const INITIAL_PASSWORD_FILE = path.join(VAR_DIR, 'admin-initial-password.txt');

const BANNER_LINE = '═'.repeat(60);

/**
 * Generate a strong URL-safe admin password. 24 base64url chars ≈ 144 bits of entropy.
 */
export function generatePassword(): string {
    return crypto.randomBytes(18).toString('base64url');
}

/**
 * Persist the just-generated admin password to `var/admin-initial-password.txt`
 * with restrictive permissions, and print a one-shot banner to stdout if the
 * process is interactive. Never logs to a log file, never writes to stdout
 * when not a TTY (prevents capture by container log shippers).
 *
 * Throws if the artefact already exists — callers must call `hasInitialPasswordArtefact`
 * first and fail loud rather than overwriting.
 */
export function writeInitialPasswordArtefact(password: string): string {
    if (fs.existsSync(INITIAL_PASSWORD_FILE)) {
        throw new Error(
            `Refusing to overwrite existing initial-password artefact at ${INITIAL_PASSWORD_FILE}. ` +
            `If this is intentional, remove the file manually after confirming no one needs it.`,
        );
    }

    fs.mkdirSync(VAR_DIR, {recursive: true, mode: 0o700});
    // Best-effort mode tightening on POSIX; Windows ignores. Writing first, then
    // chmod so even if the default umask is loose, the file ends up 0600.
    fs.writeFileSync(INITIAL_PASSWORD_FILE, password, {mode: 0o600});
    try {
        fs.chmodSync(INITIAL_PASSWORD_FILE, 0o600);
        fs.chmodSync(VAR_DIR, 0o700);
    } catch {
        // Windows / exotic filesystems — mode bits advisory. No hard fail.
    }

    if (process.stdout.isTTY) {
        const lines = [
            '',
            BANNER_LINE,
            ' INITIAL ADMIN PASSWORD = ' + password,
            ' Change on first login. This banner will not repeat.',
            ' Also written to ' + INITIAL_PASSWORD_FILE + ' (mode 0600).',
            BANNER_LINE,
            '',
        ];
        // Direct write to stdout so log frameworks cannot swallow it.
        process.stdout.write(lines.join('\n') + '\n');
    }

    return INITIAL_PASSWORD_FILE;
}

export function hasInitialPasswordArtefact(): boolean {
    return fs.existsSync(INITIAL_PASSWORD_FILE);
}

/**
 * Called when setupAdmin finds an existing password artefact but no admin user
 * in Mongo. Rather than silently re-seeding (which would invalidate the file),
 * fail loudly with instructions.
 */
export function staleArtefactError(): Error {
    return new Error(
        `Found stale initial-password artefact at ${INITIAL_PASSWORD_FILE}, but no admin user exists in the database. ` +
        `Either restore the admin user, or remove the file manually (after confirming you have no use for it) and restart.`,
    );
}
