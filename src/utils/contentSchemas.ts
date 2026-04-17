import EItemType from '../enums/EItemType';

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const validateText = (content: any): ValidationResult => {
    if (!isObject(content)) return {valid: false, error: 'Text content must be an object'};
    if (content.value !== undefined && !isString(content.value)) {
        return {valid: false, error: 'Text.value must be a string'};
    }
    return {valid: true};
};

const validateRichText = (content: any): ValidationResult => {
    if (!isObject(content)) return {valid: false, error: 'RichText content must be an object'};
    if (content.value !== undefined && !isString(content.value)) {
        return {valid: false, error: 'RichText.value must be a string'};
    }
    if (content.value && content.value.length > 200_000) {
        return {valid: false, error: 'RichText.value exceeds 200KB'};
    }
    return {valid: true};
};

const IMAGE_PATH = /^(api\/|\/api\/|https?:\/\/)/i;
const validateImagePath = (src: unknown, field: string): ValidationResult => {
    if (!src) return {valid: true};
    if (!isString(src)) return {valid: false, error: `${field} must be a string`};
    if (!IMAGE_PATH.test(src)) return {valid: false, error: `${field} must be a local api/ path or https URL`};
    return {valid: true};
};

const validateImage = (content: any): ValidationResult => {
    if (!isObject(content)) return {valid: false, error: 'Image content must be an object'};
    const srcOk = validateImagePath(content.imageLink ?? content.src ?? content.image, 'Image.src');
    if (!srcOk.valid) return srcOk;
    if (content.description !== undefined && !isString(content.description)) {
        return {valid: false, error: 'Image.description must be a string'};
    }
    return {valid: true};
};

const validateItemsList = (content: any, kind: string): ValidationResult => {
    if (!isObject(content)) return {valid: false, error: `${kind} content must be an object`};
    const items = (content as any).items;
    if (items === undefined) return {valid: true};
    if (!Array.isArray(items)) return {valid: false, error: `${kind}.items must be an array`};
    if (items.length > 200) return {valid: false, error: `${kind}.items exceeds 200 entries`};
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!isObject(it)) return {valid: false, error: `${kind}.items[${i}] must be an object`};
        if (it.text !== undefined && !isString(it.text)) {
            return {valid: false, error: `${kind}.items[${i}].text must be a string`};
        }
        const srcField = it.imageLink ?? it.src ?? it.image;
        const check = validateImagePath(srcField, `${kind}.items[${i}].src`);
        if (!check.valid) return check;
    }
    return {valid: true};
};

const VALIDATORS: Record<string, (c: any) => ValidationResult> = {
    [EItemType.Text]: validateText,
    [EItemType.RichText]: validateRichText,
    [EItemType.Image]: validateImage,
    [EItemType.Carousel]: (c) => validateItemsList(c, 'Carousel'),
    [EItemType.Gallery]: (c) => validateItemsList(c, 'Gallery'),
    [EItemType.Empty]: () => ({valid: true}),
};

export function validateItemContent(type: string | undefined, rawContent: unknown): ValidationResult {
    if (!type) return {valid: false, error: 'item.type is required'};
    const validator = VALIDATORS[type];
    if (!validator) return {valid: true}; // unknown custom types passthrough
    let parsed: unknown = rawContent;
    if (isString(rawContent)) {
        try {
            parsed = JSON.parse(rawContent);
        } catch {
            return {valid: false, error: `item.content (${type}) is not valid JSON`};
        }
    }
    return validator(parsed);
}

export function validateSectionInput(section: any): ValidationResult {
    if (!isObject(section)) return {valid: false, error: 'section must be an object'};
    if (typeof section.type !== 'number' || section.type < 1 || section.type > 10) {
        return {valid: false, error: 'section.type must be a number between 1 and 10'};
    }
    if (!isString(section.page)) return {valid: false, error: 'section.page must be a string'};
    if (section.page.length > 200) return {valid: false, error: 'section.page exceeds 200 characters'};
    if (section.content !== undefined) {
        if (!Array.isArray(section.content)) return {valid: false, error: 'section.content must be an array'};
        for (let i = 0; i < section.content.length; i++) {
            const item = section.content[i];
            if (!isObject(item)) return {valid: false, error: `section.content[${i}] must be an object`};
            const result = validateItemContent(item.type as string, item.content);
            if (!result.valid) return {valid: false, error: `section.content[${i}]: ${result.error}`};
        }
    }
    return {valid: true};
}
