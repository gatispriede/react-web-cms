/**
 * checkout-as-composable-page (Phase 1.D) — Checkout feature loader.
 *
 * Side-effect imports register the 9 checkout/order/account system
 * pages with the `SystemPageRegistry`. The Pages feature's `onBoot`
 * drives the actual Mongo upsert at boot.
 *
 * Phase 1.B-c — also stamps the live `ShippingMethodService` into the
 * module-scoped registry slot so MCP tools + the storefront resolver
 * can reach it.
 */
import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureContext} from '@services/infra/featureManifest';
import './CheckoutSystemPages';
// Side-effect import — registers commerce.checkout.* flags at module load.
import '@services/features/Commerce/commerceFlags';
import {ShippingMethodService, registerShippingMethodService} from './ShippingMethodService';

export class CheckoutFeatureLoader extends ServiceLoader {
    readonly id = 'checkout';
    readonly displayName = 'Checkout';

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        const shippingMethods = new ShippingMethodService(ctx.db.collection('ShippingMethods'));
        registerShippingMethodService(shippingMethods);
        // Fire-and-forget seed — adds "Standard delivery" if collection empty.
        void shippingMethods.seedDefaults('system').catch(() => undefined);
        return {shippingMethods};
    }
}
