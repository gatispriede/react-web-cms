/**
 * client-account-settings-page (Phase 1.E) — register the
 * `account-settings` entry on the `SystemPageRegistry`.
 *
 * Default layout matches the spec:
 *
 *   1. AccountSettingsHero  (locked, optional)
 *   2. AccountSettingsNav   (locked, required)
 *   3. AccountSettingsForm  (locked, required, dispatches by ?tab=)
 *   4. (operator-composable space — empty by default)
 *
 * Registered as a module-load side-effect so the `Customer` service
 * loader's `onBoot` doesn't have to thread a separate import. The
 * Pages feature's existing `bootstrapAll(svc)` call drives the
 * actual Mongo upsert at boot.
 */
import guid from '@utils/guid';
import {systemPageRegistry} from '@services/features/Pages/SystemPageRegistry';
import {EItemType} from '@enums/EItemType';
import type {ISection} from '@interfaces/ISection';

function lockedSection(moduleType: EItemType, lockReason: string): ISection {
    return {
        id: guid(),
        type: 1,
        content: [
            {
                type: moduleType,
                content: '',
            },
        ],
        locked: true,
        lockReason,
    };
}

systemPageRegistry.register({
    systemKey: 'account-settings',
    slug: '/account/settings',
    titleI18nKey: 'account.settings.title',
    accessGate: 'customer-session',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.AccountSettingsHero, 'section.locked.account-settings-hero'),
        lockedSection(EItemType.AccountSettingsNav, 'section.locked.account-settings-nav'),
        lockedSection(EItemType.AccountSettingsForm, 'section.locked.account-settings-form'),
    ],
});
