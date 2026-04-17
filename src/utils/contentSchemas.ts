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

const validateHero = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'Hero content must be an object'};
    for (const f of ['headline', 'subtitle', 'tagline', 'accent'] as const) {
        if (c[f] !== undefined && !isString(c[f])) return {valid: false, error: `Hero.${f} must be a string`};
    }
    return validateImagePath(c.bgImage, 'Hero.bgImage');
};

const validateProjectCard = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'ProjectCard content must be an object'};
    for (const f of ['title', 'description'] as const) {
        if (c[f] !== undefined && !isString(c[f])) return {valid: false, error: `ProjectCard.${f} must be a string`};
    }
    const imgCheck = validateImagePath(c.image, 'ProjectCard.image');
    if (!imgCheck.valid) return imgCheck;
    if (c.tags !== undefined) {
        if (!Array.isArray(c.tags)) return {valid: false, error: 'ProjectCard.tags must be an array'};
        if (c.tags.some((t: unknown) => !isString(t))) return {valid: false, error: 'ProjectCard.tags entries must be strings'};
        if (c.tags.length > 30) return {valid: false, error: 'ProjectCard.tags exceeds 30 entries'};
    }
    for (const f of ['primaryLink', 'secondaryLink'] as const) {
        if (c[f] !== undefined) {
            if (!isObject(c[f])) return {valid: false, error: `ProjectCard.${f} must be an object`};
            if (c[f].url !== undefined && !isString(c[f].url)) return {valid: false, error: `ProjectCard.${f}.url must be a string`};
            if (c[f].label !== undefined && !isString(c[f].label)) return {valid: false, error: `ProjectCard.${f}.label must be a string`};
        }
    }
    return {valid: true};
};

const validateSkillPills = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'SkillPills content must be an object'};
    if (c.category !== undefined && !isString(c.category)) return {valid: false, error: 'SkillPills.category must be a string'};
    if (c.items !== undefined) {
        if (!Array.isArray(c.items)) return {valid: false, error: 'SkillPills.items must be an array'};
        if (c.items.some((t: unknown) => !isString(t))) return {valid: false, error: 'SkillPills.items entries must be strings'};
        if (c.items.length > 100) return {valid: false, error: 'SkillPills.items exceeds 100 entries'};
    }
    return {valid: true};
};

const validateTimeline = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'Timeline content must be an object'};
    if (c.entries === undefined) return {valid: true};
    if (!Array.isArray(c.entries)) return {valid: false, error: 'Timeline.entries must be an array'};
    if (c.entries.length > 100) return {valid: false, error: 'Timeline.entries exceeds 100 entries'};
    for (let i = 0; i < c.entries.length; i++) {
        const e = c.entries[i];
        if (!isObject(e)) return {valid: false, error: `Timeline.entries[${i}] must be an object`};
        for (const f of ['start', 'end', 'company', 'role', 'location'] as const) {
            if (e[f] !== undefined && !isString(e[f])) return {valid: false, error: `Timeline.entries[${i}].${f} must be a string`};
        }
        if (e.achievements !== undefined) {
            if (!Array.isArray(e.achievements)) return {valid: false, error: `Timeline.entries[${i}].achievements must be an array`};
            if (e.achievements.some((a: unknown) => !isString(a))) return {valid: false, error: `Timeline.entries[${i}].achievements entries must be strings`};
        }
    }
    return {valid: true};
};

const validateSocialLinks = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'SocialLinks content must be an object'};
    if (c.links === undefined) return {valid: true};
    if (!Array.isArray(c.links)) return {valid: false, error: 'SocialLinks.links must be an array'};
    for (let i = 0; i < c.links.length; i++) {
        const link = c.links[i];
        if (!isObject(link)) return {valid: false, error: `SocialLinks.links[${i}] must be an object`};
        if (link.platform !== undefined && !isString(link.platform)) return {valid: false, error: `SocialLinks.links[${i}].platform must be a string`};
        if (link.url !== undefined && !isString(link.url)) return {valid: false, error: `SocialLinks.links[${i}].url must be a string`};
        if (link.label !== undefined && !isString(link.label)) return {valid: false, error: `SocialLinks.links[${i}].label must be a string`};
    }
    return {valid: true};
};

const validateBlogFeed = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'BlogFeed content must be an object'};
    if (c.limit !== undefined && (typeof c.limit !== 'number' || c.limit < 1 || c.limit > 24)) {
        return {valid: false, error: 'BlogFeed.limit must be a number between 1 and 24'};
    }
    if (c.tag !== undefined && !isString(c.tag)) return {valid: false, error: 'BlogFeed.tag must be a string'};
    if (c.heading !== undefined && !isString(c.heading)) return {valid: false, error: 'BlogFeed.heading must be a string'};
    return {valid: true};
};

const VALIDATORS: Record<string, (c: any) => ValidationResult> = {
    [EItemType.Text]: validateText,
    [EItemType.RichText]: validateRichText,
    [EItemType.Image]: validateImage,
    [EItemType.Carousel]: (c) => validateItemsList(c, 'Carousel'),
    [EItemType.Gallery]: (c) => validateItemsList(c, 'Gallery'),
    [EItemType.Hero]: validateHero,
    [EItemType.ProjectCard]: validateProjectCard,
    [EItemType.SkillPills]: validateSkillPills,
    [EItemType.Timeline]: validateTimeline,
    [EItemType.SocialLinks]: validateSocialLinks,
    [EItemType.BlogFeed]: validateBlogFeed,
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
