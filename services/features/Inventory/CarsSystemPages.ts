/**
 * all-pages-module-composed (Cars batch) — register the `/cars` index
 * and `/cars/[slug]` detail system pages on the `SystemPageRegistry`.
 *
 *   1. cars-index   `/cars`        — locked `CarsList` faceted listing.
 *   2. cars-detail  `/cars/[slug]` — locked `CarDetail`; the smart
 *      wrapper reads `[slug]` and fetches via `/api/cars?slug=…`.
 *
 * Both `indexable: true` — cars is a storefront surface. The page files
 * keep their SEO `<Head>` (title + description per car); the listing /
 * detail body is replaced by `SystemPageDispatch`.
 *
 * Imported from the core-infrastructure `PagesServiceLoader` (not a
 * cars/inventory loader) so the `/cars` routes resolve even when the
 * cars vertical's optional services are off — same rationale as
 * `MarketingSystemPages`.
 */
import guid from '@utils/guid';
import {systemPageRegistry} from '@services/features/Pages/SystemPageRegistry';
import {EItemType} from '@enums/EItemType';
import type {ISection} from '@interfaces/ISection';

function lockedSection(moduleType: EItemType, lockReason: string): ISection {
    return {
        id: guid(),
        type: 1,
        content: [{type: moduleType, content: ''}],
        locked: true,
        lockReason,
    };
}

systemPageRegistry.register({
    systemKey: 'cars-index',
    slug: '/cars',
    titleI18nKey: 'cars.index.title',
    accessGate: 'open',
    seo: {indexable: true},
    defaultSections: () => [
        lockedSection(EItemType.CarsList, 'section.locked.cars-index'),
    ],
});

systemPageRegistry.register({
    systemKey: 'cars-detail',
    slug: '/cars/[slug]',
    titleI18nKey: 'cars.detail.title',
    accessGate: 'open',
    seo: {indexable: true},
    defaultSections: () => [
        lockedSection(EItemType.CarDetail, 'section.locked.cars-detail'),
    ],
});
