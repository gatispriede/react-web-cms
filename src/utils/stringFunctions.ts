export const sanitizeKey = (key: string) => {
    if(typeof key === 'undefined' || typeof key.replace === 'undefined'){
        return key
    }
    const specialsRemoved = key.replace(/[~`\s!@#$%^&*\(\)+={}\[\];:\'\"<>.,\/\\-_]/gm, '');
    if (specialsRemoved.length > 30) {
        return specialsRemoved.substr(0, 30);
    }
    return specialsRemoved;
}