/**
 * all-pages-module-composed (Account batch) — register the 4 customer
 * `/account/*` list/detail system pages on the `SystemPageRegistry`.
 *
 *   1. account-orders        `/account/orders`
 *   2. account-order-detail  `/account/orders/[id]`
 *   3. account-addresses     `/account/addresses`
 *   4. account-inbox         `/account/inbox`
 *
 * Each default layout is a single locked section holding the matching
 * smart-wrapper module (`OrdersList` / `OrderDetail` / `AddressList` /
 * `NotificationInbox` from `ui/client/modules/_AccountPageModules/`).
 * Operators can compose marketing / help modules around the locked
 * section but cannot remove the transactional block.
 *
 * Cargo-cult of `CheckoutSystemPages.ts` + `CustomerSettingsPage.ts`.
 * Registered as a module-load side-effect — `CustomerServiceLoader`
 * imports this file; the Pages feature's `bootstrapAll()` drives the
 * Mongo upsert at boot.
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
    systemKey: 'account-orders',
    slug: '/account/orders',
    titleI18nKey: 'account.orders.title',
    accessGate: 'customer-session',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.OrdersList, 'section.locked.account-orders'),
    ],
});

systemPageRegistry.register({
    systemKey: 'account-order-detail',
    slug: '/account/orders/[id]',
    titleI18nKey: 'account.orderDetail.title',
    accessGate: 'customer-session',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.OrderDetail, 'section.locked.account-order-detail'),
    ],
});

systemPageRegistry.register({
    systemKey: 'account-addresses',
    slug: '/account/addresses',
    titleI18nKey: 'account.addresses.title',
    accessGate: 'customer-session',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.AddressList, 'section.locked.account-addresses'),
    ],
});

systemPageRegistry.register({
    systemKey: 'account-inbox',
    slug: '/account/inbox',
    titleI18nKey: 'account.inbox.title',
    accessGate: 'customer-session',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.NotificationInbox, 'section.locked.account-inbox'),
    ],
});
