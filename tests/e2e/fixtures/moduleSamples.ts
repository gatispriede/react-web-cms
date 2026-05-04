import {EItemType} from '@enums/EItemType';

// Minimum-valid content per `EItemType`. Single source of truth for the
// chain spec that adds every module to a page. New module types added to
// `EItemType` without a corresponding entry here will *fail* the registry
// completeness check at the bottom — that's intentional. CI pressure
// forces whoever ships a new module to also ship a test sample.
//
// Each sample has:
//   - `style`: the registered style enum value (matches EStyle.Default = 'default')
//   - `content`: the module-specific shape from
//     `docs/architecture/module-interfaces.md`. The chain spec
//     JSON.stringifies this when forming the `IItem.content` field.
//   - `markerText`: a substring guaranteed to appear in the rendered
//     output, used by the public-render assertion. Picked to be unique
//     per type so the assertion doesn't false-match across modules.
//   - `assertSelector?`: optional CSS selector if `markerText` isn't
//     enough (e.g. modules that render images / icons but no text).

export interface ModuleSample {
    type: EItemType;
    style: string;
    content: Record<string, unknown>;
    markerText?: string;
    assertSelector?: string;
}

// Helper to keep marker text stable but namespaced per test run.
export const sampleMarker = (type: EItemType, runId: string) =>
    `e2e-${runId}-${type.toLowerCase().replace(/_/g, '-')}`;

const placeholderImg = 'https://funisimo.pro/screenshots/placeholder.png';

/**
 * Registry of supported module types. Build a runtime snapshot per chain
 * test by calling `buildSamples(runId)` — that injects unique marker
 * text into each sample so parallel/repeat runs don't false-match.
 */
export function buildSamples(runId: string): ModuleSample[] {
    const m = (type: EItemType) => sampleMarker(type, runId);
    return [
        {
            type: EItemType.Text,
            style: 'default',
            content: {value: m(EItemType.Text)},
            markerText: m(EItemType.Text),
        },
        {
            type: EItemType.RichText,
            style: 'default',
            content: {value: `<p><strong>${m(EItemType.RichText)}</strong></p>`},
            markerText: m(EItemType.RichText),
        },
        {
            type: EItemType.Hero,
            style: 'default',
            content: {
                headline: m(EItemType.Hero),
                subtitle: 'sample subtitle',
                tagline: 'sample tagline',
                bgImage: '',
                accent: '#888888',
            },
            markerText: m(EItemType.Hero),
        },
        {
            type: EItemType.Timeline,
            style: 'default',
            content: {
                entries: [
                    {
                        start: '2024',
                        end: '2025',
                        company: m(EItemType.Timeline),
                        role: 'sample role',
                    },
                ],
            },
            markerText: m(EItemType.Timeline),
        },
        {
            type: EItemType.SkillPills,
            style: 'default',
            content: {
                category: m(EItemType.SkillPills),
                items: ['typescript', 'mongo', 'redis'],
            },
            markerText: m(EItemType.SkillPills),
        },
        {
            type: EItemType.Services,
            style: 'default',
            content: {
                rows: [
                    {number: '01', title: m(EItemType.Services), description: 'sample description'},
                ],
            },
            markerText: m(EItemType.Services),
        },
        {
            type: EItemType.Testimonials,
            style: 'default',
            content: {
                items: [{quote: m(EItemType.Testimonials), name: 'sample name'}],
            },
            markerText: m(EItemType.Testimonials),
        },
        {
            type: EItemType.ProjectGrid,
            style: 'default',
            content: {
                items: [{title: m(EItemType.ProjectGrid)}],
            },
            markerText: m(EItemType.ProjectGrid),
        },
        {
            type: EItemType.Manifesto,
            style: 'default',
            content: {body: m(EItemType.Manifesto)},
            markerText: m(EItemType.Manifesto),
        },
        {
            type: EItemType.StatsCard,
            style: 'default',
            content: {
                stats: [{value: '42', label: m(EItemType.StatsCard)}],
            },
            markerText: m(EItemType.StatsCard),
        },
        {
            type: EItemType.List,
            style: 'default',
            content: {
                items: [{label: m(EItemType.List)}],
            },
            markerText: m(EItemType.List),
        },
        {
            type: EItemType.Gallery,
            style: 'default',
            content: {
                items: [
                    {
                        alt: m(EItemType.Gallery),
                        src: placeholderImg,
                        text: '',
                        height: 200,
                        imgWidth: 200,
                        imgHeight: 200,
                        textPosition: 'BOTTOM',
                        preview: false,
                    },
                ],
                disablePreview: false,
            },
            markerText: m(EItemType.Gallery),
            assertSelector: `img[alt*="${m(EItemType.Gallery)}"]`,
        },
        {
            type: EItemType.Image,
            style: 'default',
            content: {
                src: placeholderImg,
                alt: m(EItemType.Image),
                description: '',
                height: 200,
                preview: false,
                imgWidth: 200,
                imgHeight: 200,
                useAsBackground: false,
                imageFixed: false,
                useGradiant: false,
                offsetX: 0,
            },
            assertSelector: `img[alt*="${m(EItemType.Image)}"]`,
        },
        {
            type: EItemType.Carousel,
            style: 'default',
            content: {
                items: [
                    {
                        alt: m(EItemType.Carousel),
                        src: placeholderImg,
                        text: '',
                        height: 200,
                        imgWidth: 200,
                        imgHeight: 200,
                        textPosition: 'BOTTOM',
                        preview: false,
                    },
                ],
                autoplay: false,
                infinity: false,
                autoplaySpeed: 0,
                dots: false,
                arrows: false,
                disablePreview: true,
            },
            assertSelector: `img[alt*="${m(EItemType.Carousel)}"]`,
        },
        {
            type: EItemType.BlogFeed,
            style: 'default',
            content: {limit: 3, tag: '', heading: m(EItemType.BlogFeed)},
            markerText: m(EItemType.BlogFeed),
        },
        {
            type: EItemType.SocialLinks,
            style: 'default',
            content: {
                links: [{platform: 'github', url: 'https://github.com/example', label: m(EItemType.SocialLinks)}],
            },
            markerText: m(EItemType.SocialLinks),
        },
        {
            type: EItemType.ProjectCard,
            style: 'default',
            content: {
                title: m(EItemType.ProjectCard),
                description: 'sample description',
                image: placeholderImg,
                tags: ['sample'],
            },
            markerText: m(EItemType.ProjectCard),
        },
    ];
}

// `EItemType` values that the registry intentionally omits. Update if a
// sample is added later. The completeness check below excludes these.
const REGISTRY_OMISSIONS: ReadonlySet<EItemType> = new Set([
    EItemType.Empty,                   // synthetic placeholder, not user-addable
    EItemType.InquiryForm,             // form integration, separate spec needed
    EItemType.DataModel,               // dev-portfolio specific
    EItemType.InfraTopology,           // dev-portfolio specific
    EItemType.PipelineFlow,            // dev-portfolio specific
    EItemType.RepoTree,                // dev-portfolio specific
    EItemType.ArchitectureTiers,       // dev-portfolio specific
    EItemType.StatsStrip,              // dev-portfolio specific
]);

/**
 * Throws if the registry is missing a sample for any non-omitted
 * `EItemType` member. Called from a Vitest unit test (separate file) so
 * adding a new module type to `EItemType` without a sample fails CI.
 */
export function assertRegistryComplete(): void {
    const samples = buildSamples('check');
    const covered = new Set(samples.map(s => s.type));
    const missing: EItemType[] = [];
    for (const value of Object.values(EItemType)) {
        if (REGISTRY_OMISSIONS.has(value)) continue;
        if (!covered.has(value)) missing.push(value);
    }
    if (missing.length) {
        throw new Error(
            `moduleSamples.ts is missing entries for: ${missing.join(', ')}. ` +
                `Either add a sample or list the type in REGISTRY_OMISSIONS with a reason.`,
        );
    }
}

/**
 * Mulberry32 — small deterministic PRNG. Seeded from a numeric seed,
 * returns a function that produces uniform [0, 1) numbers. Used by the
 * chain spec to shuffle module-add order reproducibly: the seed is
 * printed on every run so a flaky pass can be replayed bit-for-bit by
 * exporting `E2E_RANDOM_SEED=<n>`.
 */
export function mulberry32(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let r = t;
        r = Math.imul(r ^ (r >>> 15), r | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

/** Fisher–Yates with the supplied PRNG. Mutates `arr` and returns it. */
export function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
