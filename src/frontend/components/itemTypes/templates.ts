import {EItemType} from "../../../enums/EItemType";
import {EStyle} from "../../../enums/EStyle";

/**
 * A "Start from template" preset. Each template creates a single new section
 * pre-populated with 1+ item instances, so admins don't have to hand-assemble
 * every block from scratch. Shown next to the blank-layout picker in the
 * `AddNewSection` dialog and in the `DynamicTabsContent` empty state.
 *
 * `type` is the section layout: 1 = 100%, 2 = 50/50, 3 = 33×3, 4 = 25×4.
 * Items slot into the layout left-to-right; surplus slots render as Empty.
 */
export interface SectionItemTemplate {
    type: EItemType;
    style?: string;
    content: string;
    action?: string;
    actionStyle?: string;
    actionType?: EItemType;
    actionContent?: string;
}

export interface SectionTemplate {
    key: string;
    /** Translation key for the admin label. */
    labelKey: string;
    /** Translation key for a one-line blurb shown under the label. */
    descriptionKey: string;
    /** Emoji shown in the picker tile — cheap visual. */
    icon: string;
    /** Section layout type (1/2/3/4). */
    sectionType: number;
    /** Items inserted in order into the new section. */
    items: SectionItemTemplate[];
}

const item = (type: EItemType, content: object, extras: Partial<SectionItemTemplate> = {}): SectionItemTemplate => ({
    type,
    style: EStyle.Default,
    content: JSON.stringify(content),
    action: 'none',
    actionType: EItemType.Text,
    actionStyle: EStyle.Default,
    actionContent: '{}',
    ...extras,
});

export const SECTION_TEMPLATES: SectionTemplate[] = [
    {
        key: 'hero',
        labelKey: 'Hero',
        descriptionKey: 'Big headline + tagline.',
        icon: '🎯',
        sectionType: 1,
        items: [
            item(EItemType.Hero, {
                headline: 'Your headline here',
                subtitle: 'One sentence that says what you do.',
                tagline: 'A short, memorable phrase.',
                bgImage: '',
                accent: '',
            }),
        ],
    },
    {
        key: 'gallery',
        labelKey: 'Gallery',
        descriptionKey: 'Three-column image grid with captions.',
        icon: '🖼️',
        sectionType: 1,
        items: [
            item(EItemType.Gallery, {items: [
                {src: '', text: ''},
                {src: '', text: ''},
                {src: '', text: ''},
            ]}),
        ],
    },
    {
        key: 'article',
        labelKey: 'Article',
        descriptionKey: 'Heading + long-form rich text.',
        icon: '📝',
        sectionType: 1,
        items: [
            item(EItemType.Text, {value: 'Article title'}),
            item(EItemType.RichText, {value: '<p>Write your article here — drop in links, lists, and imagery via the rich-text editor.</p>'}),
        ],
    },
    {
        key: 'contact',
        labelKey: 'Contact',
        descriptionKey: 'Heading + social links pills.',
        icon: '📬',
        sectionType: 1,
        items: [
            item(EItemType.Text, {value: 'Get in touch'}),
            item(EItemType.SocialLinks, {links: [
                {label: 'Email', url: 'mailto:you@example.com'},
                {label: 'LinkedIn', url: 'https://linkedin.com/in/you'},
                {label: 'GitHub', url: 'https://github.com/you'},
            ]}),
        ],
    },
    {
        key: 'two-column',
        labelKey: 'Two-column',
        descriptionKey: 'Side-by-side text + image.',
        icon: '🔲',
        sectionType: 2,
        items: [
            item(EItemType.RichText, {value: '<p>Tell the story on one side…</p>'}),
            item(EItemType.Image, {src: '', useAsBackground: false}),
        ],
    },
    {
        key: 'skills',
        labelKey: 'Skills',
        descriptionKey: 'Tag-style skill pills, two categories.',
        icon: '🏷️',
        sectionType: 2,
        items: [
            item(EItemType.SkillPills, {category: 'Tech stack', items: ['Your', 'Tools', 'Here']}),
            item(EItemType.SkillPills, {category: 'Leadership', items: ['Soft', 'Skills', 'Here']}),
        ],
    },
];
