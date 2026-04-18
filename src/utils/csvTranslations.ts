/**
 * Minimal RFC-4180-ish CSV parser tuned for translation round-trips.
 *
 * Supports:
 *  - Quoted fields with embedded commas, newlines, and doubled quotes ("").
 *  - CRLF or LF line endings.
 *  - A required header row.
 *
 * Returns `{header, rows}` — each row is a string array aligned to `header`.
 */
export interface ParsedCsv {
    header: string[];
    rows: string[][];
}

export function parseCsv(input: string): ParsedCsv {
    const src = (input ?? '').replace(/\r\n/g, '\n');
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQuotes) {
            if (c === '"') {
                if (src[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += c;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    const cleaned = rows.filter(r => r.some(v => v !== ''));
    const header = cleaned.shift() ?? [];
    return {header, rows: cleaned};
}

/**
 * Extract a `{key → value}` map for a target locale column from a parsed CSV.
 * The header must contain at least `key` + the target locale symbol.
 * Empty values are skipped so they don't overwrite existing translations with
 * blanks. `source` is ignored on import — it's only informational.
 */
export function translationsFromCsv(
    {header, rows}: ParsedCsv,
    targetLocale: string,
): Record<string, string> {
    const keyIdx = header.findIndex(h => h.trim().toLowerCase() === 'key');
    const locIdx = header.findIndex(h => h.trim().toLowerCase() === targetLocale.toLowerCase());
    if (keyIdx < 0) throw new Error('CSV is missing a "key" column');
    if (locIdx < 0) throw new Error(`CSV is missing a "${targetLocale}" column`);
    const out: Record<string, string> = {};
    for (const row of rows) {
        const key = (row[keyIdx] ?? '').trim();
        if (!key) continue;
        const val = row[locIdx] ?? '';
        if (val === '') continue;
        out[key] = val;
    }
    return out;
}
