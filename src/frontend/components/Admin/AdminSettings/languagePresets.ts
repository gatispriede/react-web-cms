/**
 * Curated list of common locales admins can pick from when adding a language.
 * Symbol is the ISO 639-1 code. Flag is the Unicode regional-indicator
 * emoji for the matching ISO 3166-1 country — rendered inline in the public
 * language dropdown. Shipping as emoji keeps this asset-free and keyboard-
 * copy-pasteable; fall back to the `symbol` letters when a font doesn't
 * render flags.
 */
export interface LanguagePreset {
    symbol: string;
    label: string;
    flag: string;
}

export const LANGUAGE_PRESETS: LanguagePreset[] = [
    {symbol: 'en', label: 'English',        flag: '🇬🇧'},
    {symbol: 'us', label: 'English (US)',   flag: '🇺🇸'},
    {symbol: 'lv', label: 'Latviešu',       flag: '🇱🇻'},
    {symbol: 'lt', label: 'Lietuvių',       flag: '🇱🇹'},
    {symbol: 'et', label: 'Eesti',          flag: '🇪🇪'},
    {symbol: 'de', label: 'Deutsch',        flag: '🇩🇪'},
    {symbol: 'fr', label: 'Français',       flag: '🇫🇷'},
    {symbol: 'es', label: 'Español',        flag: '🇪🇸'},
    {symbol: 'it', label: 'Italiano',       flag: '🇮🇹'},
    {symbol: 'pt', label: 'Português',      flag: '🇵🇹'},
    {symbol: 'nl', label: 'Nederlands',     flag: '🇳🇱'},
    {symbol: 'se', label: 'Svenska',        flag: '🇸🇪'},
    {symbol: 'no', label: 'Norsk',          flag: '🇳🇴'},
    {symbol: 'da', label: 'Dansk',          flag: '🇩🇰'},
    {symbol: 'fi', label: 'Suomi',          flag: '🇫🇮'},
    {symbol: 'is', label: 'Íslenska',       flag: '🇮🇸'},
    {symbol: 'pl', label: 'Polski',         flag: '🇵🇱'},
    {symbol: 'cs', label: 'Čeština',        flag: '🇨🇿'},
    {symbol: 'sk', label: 'Slovenčina',     flag: '🇸🇰'},
    {symbol: 'hu', label: 'Magyar',         flag: '🇭🇺'},
    {symbol: 'ro', label: 'Română',         flag: '🇷🇴'},
    {symbol: 'bg', label: 'Български',      flag: '🇧🇬'},
    {symbol: 'hr', label: 'Hrvatski',       flag: '🇭🇷'},
    {symbol: 'sr', label: 'Српски',         flag: '🇷🇸'},
    {symbol: 'sl', label: 'Slovenščina',    flag: '🇸🇮'},
    {symbol: 'el', label: 'Ελληνικά',       flag: '🇬🇷'},
    {symbol: 'ru', label: 'Русский',        flag: '🇷🇺'},
    {symbol: 'uk', label: 'Українська',     flag: '🇺🇦'},
    {symbol: 'be', label: 'Беларуская',     flag: '🇧🇾'},
    {symbol: 'tr', label: 'Türkçe',         flag: '🇹🇷'},
    {symbol: 'ar', label: 'العربية',         flag: '🇸🇦'},
    {symbol: 'he', label: 'עברית',          flag: '🇮🇱'},
    {symbol: 'zh', label: '中文',            flag: '🇨🇳'},
    {symbol: 'ja', label: '日本語',          flag: '🇯🇵'},
    {symbol: 'ko', label: '한국어',          flag: '🇰🇷'},
    {symbol: 'hi', label: 'हिन्दी',          flag: '🇮🇳'},
    {symbol: 'th', label: 'ไทย',            flag: '🇹🇭'},
    {symbol: 'vi', label: 'Tiếng Việt',     flag: '🇻🇳'},
    {symbol: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩'},
];

/** Fallback label for symbols not in the preset list. */
export const findPresetBySymbol = (symbol?: string): LanguagePreset | undefined =>
    symbol ? LANGUAGE_PRESETS.find(p => p.symbol.toLowerCase() === symbol.toLowerCase()) : undefined;
