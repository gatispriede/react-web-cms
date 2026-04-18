import {sanitizeKey} from "./stringFunctions";

type TFn = (key: string) => string;

/**
 * Pass author-provided text through i18n but fall back to the original when
 * no translation exists for the sanitized key.
 *
 * Without this, rendering `tApp(sanitizeKey("Hello, world"))` returns
 * `"Helloworld"` (the sanitized key itself) on first paint before any
 * translation has been authored — which is what made section output look
 * truncated compared to what the admin entered.
 */
export function translateOrKeep(tApp: TFn | undefined, value: string): string {
    if (!value) return '';
    if (!tApp) return value;
    const key = sanitizeKey(value);
    const translated = tApp(key);
    return translated === key ? value : translated;
}
