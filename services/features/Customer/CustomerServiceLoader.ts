/**
 * client-account-settings-page (Phase 1.E) — Customer feature loader.
 *
 * Owns `CustomerProfileService` (extended customer-profile CRUD that
 * `CustomerAuthService` deliberately doesn't carry — addresses CRUD
 * already lives there but company/payment-methods / type-switch is
 * net-new). Side-effect imports register:
 *   - `commerce.*` customer flags (`customerFlags.ts`)
 *   - `account-settings` on the system-page registry
 *     (`CustomerSettingsPage.ts`)
 *   - `account-orders` / `account-order-detail` / `account-addresses` /
 *     `account-inbox` system pages (`CustomerAccountPages.ts`)
 */
import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureContext} from '@services/infra/featureManifest';
import {CustomerProfileService} from './CustomerProfileService';
import './customerFlags';
import './CustomerSettingsPage';
import './CustomerAccountPages';

export class CustomerServiceLoader extends ServiceLoader {
    readonly id = 'customer';
    readonly displayName = 'Customer profile';

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {
            customerProfile: new CustomerProfileService(ctx.db.collection('Users')),
        };
    }
}
