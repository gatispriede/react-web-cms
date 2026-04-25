import EItemType from '@enums/EItemType';

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

const IMAGE_PATH = /^(api\/|\/api\/|https?:\/\/|data:image\/|[^:]*$)/i;
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
    if (c.categoryMeta !== undefined && !isString(c.categoryMeta)) return {valid: false, error: 'SkillPills.categoryMeta must be a string'};
    if (c.items !== undefined) {
        if (!Array.isArray(c.items)) return {valid: false, error: 'SkillPills.items must be an array'};
        if (c.items.length > 100) return {valid: false, error: 'SkillPills.items exceeds 100 entries'};
        for (let i = 0; i < c.items.length; i++) {
            const it = c.items[i];
            // Legacy form: plain string labels.
            if (isString(it)) continue;
            // New form (matrix mode): `{label, score?, featured?}`.
            if (!isObject(it)) return {valid: false, error: `SkillPills.items[${i}] must be a string or object`};
            if (!isString(it.label)) return {valid: false, error: `SkillPills.items[${i}].label must be a string`};
            if (it.score !== undefined && (typeof it.score !== 'number' || it.score < 0 || it.score > 10)) {
                return {valid: false, error: `SkillPills.items[${i}].score must be a number 0–10`};
            }
            if (it.featured !== undefined && typeof it.featured !== 'boolean') {
                return {valid: false, error: `SkillPills.items[${i}].featured must be boolean`};
            }
            if (it.category !== undefined && !isString(it.category)) {
                return {valid: false, error: `SkillPills.items[${i}].category must be a string`};
            }
        }
    }
    return {valid: true};
};

const validateProjectGrid = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'ProjectGrid content must be an object'};
    for (const f of ['sectionNumber', 'sectionTitle', 'sectionSubtitle'] as const) {
        if (c[f] !== undefined && !isString(c[f])) return {valid: false, error: `ProjectGrid.${f} must be a string`};
    }
    if (c.items !== undefined) {
        if (!Array.isArray(c.items)) return {valid: false, error: 'ProjectGrid.items must be an array'};
        if (c.items.length > 50) return {valid: false, error: 'ProjectGrid.items exceeds 50 entries'};
        for (let i = 0; i < c.items.length; i++) {
            const it = c.items[i];
            if (!isObject(it)) return {valid: false, error: `ProjectGrid.items[${i}] must be an object`};
            for (const f of ['title', 'stack', 'kind', 'year', 'coverArt', 'coverColor', 'moreLabel', 'href'] as const) {
                if (it[f] !== undefined && !isString(it[f])) return {valid: false, error: `ProjectGrid.items[${i}].${f} must be a string`};
            }
        }
    }
    return {valid: true};
};

const validateManifesto = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'Manifesto content must be an object'};
    for (const f of ['body', 'addendum'] as const) {
        if (c[f] !== undefined && !isString(c[f])) return {valid: false, error: `Manifesto.${f} must be a string`};
    }
    if (c.chips !== undefined) {
        if (!Array.isArray(c.chips)) return {valid: false, error: 'Manifesto.chips must be an array'};
        if (c.chips.length > 40) return {valid: false, error: 'Manifesto.chips exceeds 40 entries'};
        for (let i = 0; i < c.chips.length; i++) {
            const ch = c.chips[i];
            if (!isObject(ch)) return {valid: false, error: `Manifesto.chips[${i}] must be an object`};
            for (const f of ['key', 'thumb', 'color'] as const) {
                if (ch[f] !== undefined && !isString(ch[f])) return {valid: false, error: `Manifesto.chips[${i}].${f} must be a string`};
            }
        }
    }
    return {valid: true};
};

const validateStatsCard = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'StatsCard content must be an object'};
    for (const f of ['tag', 'title'] as const) {
        if (c[f] !== undefined && !isString(c[f])) return {valid: false, error: `StatsCard.${f} must be a string`};
    }
    if (c.stats !== undefined) {
        if (!Array.isArray(c.stats)) return {valid: false, error: 'StatsCard.stats must be an array'};
        if (c.stats.length > 20) return {valid: false, error: 'StatsCard.stats exceeds 20 entries'};
        for (let i = 0; i < c.stats.length; i++) {
            const s = c.stats[i];
            if (!isObject(s)) return {valid: false, error: `StatsCard.stats[${i}] must be an object`};
            for (const f of ['value', 'label'] as const) {
                if (s[f] !== undefined && !isString(s[f])) return {valid: false, error: `StatsCard.stats[${i}].${f} must be a string`};
            }
        }
    }
    if (c.features !== undefined) {
        if (!Array.isArray(c.features)) return {valid: false, error: 'StatsCard.features must be an array'};
        if (c.features.length > 30) return {valid: false, error: 'StatsCard.features exceeds 30 entries'};
        for (let i = 0; i < c.features.length; i++) {
            const f = c.features[i];
            if (!isObject(f)) return {valid: false, error: `StatsCard.features[${i}] must be an object`};
            if (f.text !== undefined && !isString(f.text)) return {valid: false, error: `StatsCard.features[${i}].text must be a string`};
        }
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

const validateServices = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'Services content must be an object'};
    for (const f of ['sectionNumber', 'sectionTitle', 'sectionSubtitle'] as const) {
        if (c[f] !== undefined && !isString(c[f])) return {valid: false, error: `Services.${f} must be a string`};
    }
    if (c.rows !== undefined) {
        if (!Array.isArray(c.rows)) return {valid: false, error: 'Services.rows must be an array'};
        if (c.rows.length > 50) return {valid: false, error: 'Services.rows exceeds 50 entries'};
        for (let i = 0; i < c.rows.length; i++) {
            const r = c.rows[i];
            if (!isObject(r)) return {valid: false, error: `Services.rows[${i}] must be an object`};
            for (const f of ['number', 'title', 'description', 'ctaLabel', 'ctaHref', 'iconGlyph'] as const) {
                if (r[f] !== undefined && !isString(r[f])) return {valid: false, error: `Services.rows[${i}].${f} must be a string`};
            }
            if (r.tags !== undefined) {
                if (!Array.isArray(r.tags)) return {valid: false, error: `Services.rows[${i}].tags must be an array`};
                if (r.tags.some((t: unknown) => !isString(t))) return {valid: false, error: `Services.rows[${i}].tags entries must be strings`};
            }
        }
    }
    return {valid: true};
};

const validateTestimonials = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'Testimonials content must be an object'};
    for (const f of ['sectionTitle', 'sectionSubtitle'] as const) {
        if (c[f] !== undefined && !isString(c[f])) return {valid: false, error: `Testimonials.${f} must be a string`};
    }
    if (c.items !== undefined) {
        if (!Array.isArray(c.items)) return {valid: false, error: 'Testimonials.items must be an array'};
        if (c.items.length > 50) return {valid: false, error: 'Testimonials.items exceeds 50 entries'};
        for (let i = 0; i < c.items.length; i++) {
            const it = c.items[i];
            if (!isObject(it)) return {valid: false, error: `Testimonials.items[${i}] must be an object`};
            for (const f of ['quote', 'name', 'role', 'avatarInitial'] as const) {
                if (it[f] !== undefined && !isString(it[f])) return {valid: false, error: `Testimonials.items[${i}].${f} must be a string`};
            }
        }
    }
    return {valid: true};
};

const validateList = (c: any): ValidationResult => {
    if (!isObject(c)) return {valid: false, error: 'List content must be an object'};
    if (c.title !== undefined && !isString(c.title)) return {valid: false, error: 'List.title must be a string'};
    if (c.items !== undefined) {
        if (!Array.isArray(c.items)) return {valid: false, error: 'List.items must be an array'};
        if (c.items.length > 200) return {valid: false, error: 'List.items exceeds 200 entries'};
        for (let i = 0; i < c.items.length; i++) {
            const it = c.items[i];
            if (!isObject(it)) return {valid: false, error: `List.items[${i}] must be an object`};
            if (!isString(it.label)) return {valid: false, error: `List.items[${i}].label must be a string`};
            // Extended fields (optional) used by the `cases` style — plain
            // strings each; tags are `string[]`.
            for (const f of ['value', 'href', 'prefix', 'prefixSub', 'meta'] as const) {
                if (it[f] !== undefined && !isString(it[f])) return {valid: false, error: `List.items[${i}].${f} must be a string`};
            }
            if (it.tags !== undefined) {
                if (!Array.isArray(it.tags)) return {valid: false, error: `List.items[${i}].tags must be an array`};
                if (it.tags.some((t: unknown) => !isString(t))) return {valid: false, error: `List.items[${i}].tags entries must be strings`};
            }
        }
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
    [EItemType.List]: validateList,
    [EItemType.Services]: validateServices,
    [EItemType.Testimonials]: validateTestimonials,
    [EItemType.StatsCard]: validateStatsCard,
    [EItemType.ProjectGrid]: validateProjectGrid,
    [EItemType.Manifesto]: validateManifesto,
    // CV-bundle modules — kept loose (string/array shape only) so authors
    // can iterate without fighting the schema. Tighten once the shapes
    // settle (see roadmap/cv-bundle.md).
    [EItemType.InquiryForm]: (c) => isObject(c) ? {valid: true} : {valid: false, error: 'InquiryForm content must be an object'},
    [EItemType.DataModel]: (c) => isObject(c) ? {valid: true} : {valid: false, error: 'DataModel content must be an object'},
    [EItemType.InfraTopology]: (c) => isObject(c) ? {valid: true} : {valid: false, error: 'InfraTopology content must be an object'},
    [EItemType.PipelineFlow]: (c) => isObject(c) ? {valid: true} : {valid: false, error: 'PipelineFlow content must be an object'},
    [EItemType.RepoTree]: (c) => isObject(c) ? {valid: true} : {valid: false, error: 'RepoTree content must be an object'},
    [EItemType.Empty]: () => ({valid: true}),
};

export function validateItemContent(type: string | undefined, rawContent: unknown): ValidationResult {
    if (!type) return {valid: false, error: 'item.type is required'};
    const validator = VALIDATORS[type];
    if (!validator) return {valid: true}; // unknown custom types passthrough
    // Empty items are placeholders — their content is ignored at render time,
    // so accept whatever the client sends (""/null/{}/undefined).
    if (type === EItemType.Empty) return {valid: true};
    let parsed: unknown = rawContent;
    if (isString(rawContent)) {
        if (rawContent === '') return {valid: true};
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
    if (section.slots !== undefined) {
        if (!Array.isArray(section.slots)) return {valid: false, error: 'section.slots must be an array'};
        if (section.slots.some((s: unknown) => typeof s !== 'number' || !Number.isInteger(s) || s < 1 || s > 10)) {
            return {valid: false, error: 'section.slots entries must be positive integers ≤ 10'};
        }
        const sum = section.slots.reduce((a: number, b: number) => a + b, 0);
        if (sum !== section.type) {
            return {valid: false, error: `section.slots must sum to section.type (${section.type}); got ${sum}`};
        }
        if (Array.isArray(section.content) && section.content.length !== section.slots.length) {
            return {valid: false, error: `section.slots length must match section.content length`};
        }
    }
    if (section.overlay !== undefined && typeof section.overlay !== 'boolean') {
        return {valid: false, error: 'section.overlay must be boolean'};
    }
    if (section.overlayAnchor !== undefined) {
        if (!isString(section.overlayAnchor)) return {valid: false, error: 'section.overlayAnchor must be a string'};
        const allowed = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'fill'];
        if (!allowed.includes(section.overlayAnchor)) {
            return {valid: false, error: `section.overlayAnchor must be one of: ${allowed.join(', ')}`};
        }
    }
    return {valid: true};
}
