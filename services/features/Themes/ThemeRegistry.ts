import fs from 'node:fs';
import path from 'node:path';
import {log} from '@services/infra/logger';
import type {ITheme} from '@interfaces/ITheme';
import {
    IThemeManifest,
    manifestToTokens,
} from '@interfaces/Theme/IThemeManifest';

/**
 * Wave 5 first-class theme registry.
 *
 * Walks `services/themes/<slug>/theme.json` at boot, validates each manifest,
 * and exposes the result both as `IThemeManifest[]` (admin / debug surface)
 * and as `Omit<ITheme,'id'>[]` (the legacy preset row shape that
 * `ThemeService` already seeds + upserts).
 *
 * Per spec §2 + project standards: file walk happens once at module init —
 * the result is cached in-memory for the lifetime of the process. Touch the
 * source files + restart to pick up changes; admins use the "Reset to
 * preset" flow at runtime (existing `ThemeService.resetPreset`).
 */

const THEMES_ROOT = path.join(process.cwd(), 'services/themes');

const REQUIRED_FIELDS: readonly (keyof IThemeManifest)[] = [
    'slug',
    'name',
    'tagline',
    'audience',
    'mood',
    'palette',
    'typography',
    'motion',
    'headerBehavior',
    'footerLayout',
];

function validate(raw: unknown, file: string): IThemeManifest {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`${file}: theme manifest must be a JSON object`);
    }
    const m = raw as Record<string, unknown>;
    for (const k of REQUIRED_FIELDS) {
        if (m[k] === undefined || m[k] === null) {
            throw new Error(`${file}: missing required field "${String(k)}"`);
        }
    }
    const palette = m.palette as Record<string, unknown>;
    const required = ['surface', 'ink', 'accent', 'accentInk', 'surfaceInset', 'rule'] as const;
    for (const k of required) {
        const pair = palette[k] as {light?: unknown; dark?: unknown} | undefined;
        if (!pair || typeof pair.light !== 'string' || typeof pair.dark !== 'string') {
            throw new Error(`${file}: palette.${k} must be {light: string, dark: string}`);
        }
    }
    return m as unknown as IThemeManifest;
}

let cached: IThemeManifest[] | null = null;

/**
 * Walk `services/themes/<slug>/theme.json`. Result is cached for the lifetime
 * of the process — first call does the disk read.
 */
export function loadThemeManifests(): IThemeManifest[] {
    if (cached) return cached;
    const out: IThemeManifest[] = [];
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(THEMES_ROOT, {withFileTypes: true})
            .filter(d => d.isDirectory())
            .map(d => d.name);
    } catch (err) {
        log.warn({scope: 'themes.registry', err, dir: THEMES_ROOT}, 'themes directory missing — skipping first-class theme load');
        cached = [];
        return cached;
    }
    for (const slug of entries) {
        const file = path.join(THEMES_ROOT, slug, 'theme.json');
        if (!fs.existsSync(file)) continue;
        try {
            const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
            const manifest = validate(raw, file);
            if (manifest.slug !== slug) {
                log.warn({scope: 'themes.registry', file, manifestSlug: manifest.slug, dirSlug: slug}, 'manifest slug does not match directory name; using manifest value');
            }
            out.push(manifest);
        } catch (err) {
            log.error({scope: 'themes.registry', err, file}, 'failed to load first-class theme manifest');
        }
    }
    cached = out;
    return cached;
}

/**
 * Project the registry into the legacy preset shape consumed by
 * `ThemeService.seedIfEmpty()` / preset-upsert. Existing simpleton presets
 * keep their current shape; first-class themes ride in alongside them until
 * the simpleton retire is scheduled (see roadmap).
 */
export function loadFirstClassPresetRows(): Omit<ITheme, 'id'>[] {
    return loadThemeManifests().map(m => ({
        name: m.name,
        custom: false,
        tokens: manifestToTokens(m),
    }));
}

/** Names of first-class themes — eligible for "Reset to preset" via the manifest. */
export function firstClassThemeNames(): Set<string> {
    return new Set(loadThemeManifests().map(m => m.name));
}

/** Reset cache — only intended for tests. */
export function __resetThemeRegistryCacheForTests(): void {
    cached = null;
}
