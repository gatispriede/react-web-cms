import {test} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Company-type customer checkout pre-fill
//
// Phase 1.E client-account-settings-page integrates with Phase 1.B
// sub-jump C (product-module-and-checkout-customization
// `checkout.fields.{company,vatId}`). When the checkout form ships
// the company-pre-fill mount we'll flip this spec on; until then it
// stays skipped with a forward pointer.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — company customer checkout pre-fill', () => {
    test.skip('checkout pre-fills VAT + billing address from company profile', async () => {
        // Pending Phase 1.B sub-jump C: checkout.fields.{company,vatId}
        // needs to surface on the storefront checkout form before this
        // spec can assert pre-fill behaviour. See
        // docs/roadmap/storefront/product-module-and-checkout-customization.md.
    });
});
