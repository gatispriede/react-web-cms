/**
 * GET  /api/agent/keys  — returns which AI keys are configured (masked, never full value)
 * POST /api/agent/keys  — sets or clears a key; persists to .env.local + updates process.env
 *                         so changes take effect immediately without a server restart.
 *
 * Admin-only. Stored keys are never returned in plaintext.
 */

import type {NextApiRequest, NextApiResponse} from 'next';
import {getServerSession}                     from 'next-auth/next';
import {adminAuthOptions as authOptions}      from '../auth/authOptions';
import fs   from 'fs';
import path from 'path';

const ENV_FILE = path.join(process.cwd(), '.env.local');

// The env var names managed by this endpoint, and their key prefix for validation.
const MANAGED_KEYS: Record<string, { prefix: string; label: string }> = {
    GROQ_API_KEY:      { prefix: 'gsk_', label: 'Groq'   },
    GEMINI_API_KEY:    { prefix: 'AIza', label: 'Gemini' },
    ANTHROPIC_API_KEY: { prefix: 'sk-',  label: 'Claude' },
};

/** Return masked value: first 6 + … + last 4, or empty if not set. */
function mask(value: string): string {
    if (!value || value.length < 12) return '';
    return value.slice(0, 6) + '…' + value.slice(-4);
}

/** Read .env.local and update or add a key=value line, preserving comments. */
function upsertEnvFile(varName: string, value: string): void {
    let content = '';
    try { content = fs.readFileSync(ENV_FILE, 'utf8'); } catch { /* new file */ }

    const lines  = content.split('\n');
    const pattern = new RegExp(`^\\s*#?\\s*${varName}\\s*=.*$`);
    const newLine  = value ? `${varName}=${value}` : `# ${varName}=`;

    const idx = lines.findIndex(l => pattern.test(l));
    if (idx >= 0) {
        lines[idx] = newLine;
    } else {
        // Append under the AI Agent section header if present, otherwise at end
        const sectionIdx = lines.findIndex(l => l.includes('AI Agent'));
        if (sectionIdx >= 0) {
            lines.splice(sectionIdx + 3, 0, newLine);   // after the section comment block
        } else {
            lines.push(newLine);
        }
    }

    fs.writeFileSync(ENV_FILE, lines.join('\n'), 'utf8');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getServerSession(req, res, authOptions);
    if (!session || (session.user as any)?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin session required' });
    }

    // ── GET — return masked key status ────────────────────────────────────────
    if (req.method === 'GET') {
        const status: Record<string, { set: boolean; masked: string; label: string }> = {};
        for (const [varName, meta] of Object.entries(MANAGED_KEYS)) {
            const value = process.env[varName] ?? '';
            status[varName] = { set: !!value, masked: mask(value), label: meta.label };
        }
        return res.status(200).json(status);
    }

    // ── POST — set or clear a key ─────────────────────────────────────────────
    if (req.method === 'POST') {
        const { varName, value = '' } = req.body as { varName: string; value?: string };

        if (!MANAGED_KEYS[varName]) {
            return res.status(400).json({ error: `Unknown key: ${varName}` });
        }
        const meta = MANAGED_KEYS[varName];

        // Validate non-empty values
        if (value && !value.startsWith(meta.prefix)) {
            return res.status(400).json({
                error: `${meta.label} keys must start with "${meta.prefix}"`,
            });
        }

        // Persist to .env.local
        try {
            upsertEnvFile(varName, value.trim());
        } catch (err) {
            return res.status(500).json({ error: `Could not write .env.local: ${(err as Error).message}` });
        }

        // Apply immediately to the running process — no restart needed in dev
        if (value.trim()) {
            process.env[varName] = value.trim();
        } else {
            delete process.env[varName];
        }

        return res.status(200).json({
            ok:     true,
            varName,
            set:    !!value.trim(),
            masked: mask(value.trim()),
        });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
}
