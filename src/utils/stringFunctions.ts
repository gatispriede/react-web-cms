export const sanitizeKey = (key: string) => {
    const specialsRemoved = key.replace(/[~`\s!@#$%^&*\(\)+={}\[\];:\'\"<>.,\/\\-_]/gm, '');
    if (specialsRemoved.length > 30) {
        return specialsRemoved.substr(0, 30);
    }
    return specialsRemoved;
}