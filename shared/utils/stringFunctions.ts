/**
 * Derive a stable, storage-safe translation key from a source string.
 *
 * Regex strips whitespace + punctuation + brackets + quotes. The `]`
 * inside the character class is properly escaped, unlike the previous
 * v1 regex which closed the class early and let most specials survive.
 *
 * Collision mitigation: two different long strings that share the same
 * leading 30 characters (e.g., a paragraph that's been copy-edited from
 * the end backward, or two services with the same opening phrase) would
 * previously produce the same sanitised key and silently overwrite each
 * other in the `translations` map. When the stripped source exceeds 30
 * chars we cap at 23 + `_` + 6-char hash of the *full stripped* content,
 * yielding a distinct key per distinct source while staying under the
 * 30-char ceiling that storage expects.
 *
 * Non-string input is returned unchanged (defensive guard — some callers
 * pass through undefined / numbers from loosely-typed content).
 */

const MAX_LEN = 30;
const HASH_LEN = 6;
const HEAD_LEN = MAX_LEN - HASH_LEN - 1; // 23 chars + '_' + 6-char hash = 30

function hash36(input: string): string {
    // djb2 — fast, small, good-enough distribution for a few thousand
    // translation keys. Not cryptographic; collisions are rare but
    // possible, and if they occur both strings share a key (same failure
    // mode the sub-30-char case already has).
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
        h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
    }
    return h.toString(36).padStart(HASH_LEN, '0').slice(-HASH_LEN);
}

export const sanitizeKey = (key: string): string => {
    if (typeof key !== 'string') return key as unknown as string;
    const stripped = key.replace(/[~`\s!@#$%^&*()+={}\[\];:'"<>.,/\\\-_]/g, '');
    if (stripped.length <= MAX_LEN) return stripped;
    return `${stripped.slice(0, HEAD_LEN)}_${hash36(stripped)}`;
};
