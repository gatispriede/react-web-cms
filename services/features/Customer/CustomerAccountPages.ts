/**
 * all-pages-module-composed (Account + Auth batches) — register the
 * customer `/account/*` system pages on the `SystemPageRegistry`.
 *
 * Account batch (customer-session gated):
 *   1. account-orders        `/account/orders`
 *   2. account-order-detail  `/account/orders/[id]`
 *   3. account-addresses     `/account/addresses`
 *   4. account-inbox         `/account/inbox`
 *
 * Auth batch (open — these are the surfaces you sign in *through*):
 *   5. account-signin        `/account/signin`
 *   6. account-signup        `/account/signup`
 *   7. account-magic-link    `/account/magic-link`
 *
 * Each default layout is a single locked section holding the matching
 * smart-wrapper module from `ui/client/modules/_AccountPageModules/`.
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
    systemKey: 'account-home',
    slug: '/account',
    titleI18nKey: 'account.home.title',
    accessGate: 'customer-session',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.AccountDashboardGrid, 'section.locked.account-home'),
    ],
});

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

systemPageRegistry.register({
    systemKey: 'account-signin',
    slug: '/account/signin',
    titleI18nKey: 'account.signin.title',
    accessGate: 'open',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.SigninForm, 'section.locked.account-signin'),
    ],
});

systemPageRegistry.register({
    systemKey: 'account-signup',
    slug: '/account/signup',
    titleI18nKey: 'account.signup.title',
    accessGate: 'open',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.SignupForm, 'section.locked.account-signup'),
    ],
});

systemPageRegistry.register({
    systemKey: 'account-magic-link',
    slug: '/account/magic-link',
    titleI18nKey: 'account.magicLink.title',
    accessGate: 'open',
    seo: {indexable: false},
    defaultSections: () => [
        lockedSection(EItemType.MagicLinkRequestForm, 'section.locked.account-magic-link'),
    ],
});
