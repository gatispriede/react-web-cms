export const sanitizeKey = (key: string) => {
    if(typeof key === 'undefined' || typeof key.replace === 'undefined'){
        return key
    }
    const specialsRemoved = key.replace(/[~`\s!@#$%^&*\\(\\)+={}\\[\\];:\\'\\"<>.,\/\\-_]/gm, '');
    if (specialsRemoved.length > 30) {
        return specialsRemoved.substr(0, 30);
    }
    return specialsRemoved;
}

/**
 * V2 sanitiser with a correctly-escaped character class. Strips whitespace,
 * punctuation, brackets, and quotes before the 30-char cap. NOT used yet —
 * switching is a breaking change (every existing translation is keyed off the
 * v1 output). Migration plan lives in ROADMAP → Debt.
 */
export const sanitizeKeyV2 = (key: string): string => {
    if (typeof key !== 'string') return key as unknown as string;
    const stripped = key.replace(/[~`\s!@#$%^&*()+={}\[\];:'"<>.,/\\\-_]/g, '');
    return stripped.length > 30 ? stripped.slice(0, 30) : stripped;
};