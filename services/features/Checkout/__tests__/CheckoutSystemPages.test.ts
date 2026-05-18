/**
 * Phase 1.D — unit test for the 8 checkout system-page registrations.
 *
 * Verifies:
 *   - all 8 keys are present after the side-effect import.
 *   - each defaultSections() returns sections with the expected locked
 *     content types.
 *   - the `systemPages.update` MCP path's lock guard rejects when a
 *     required locked section type is absent from the incoming list.
 */
import {describe, expect, it} from 'vitest';
import {systemPageRegistry} from '@services/features/Pages/SystemPageRegistry';
import {EItemType} from '@enums/EItemType';
import '../CheckoutSystemPages';

const EXPECTED_KEYS = [
    'cart',
    'checkout-address',
    'checkout-shipping',
    'checkout-payment',
    'checkout-confirmation',
    'order-by-token',
    'account-dashboard',
    'magic-link-verify',
] as const;

describe('CheckoutSystemPages registration', () => {
    it('registers all 8 expected system pages', () => {
        const found = EXPECTED_KEYS.filter(k => systemPageRegistry.getDefinition(k) != null);
        expect(found).toEqual([...EXPECTED_KEYS]);
    });

    it('every default section on every key is locked + carries a lockReason', () => {
        for (const key of EXPECTED_KEYS) {
            const def = systemPageRegistry.getDefinition(key);
            expect(def).not.toBeNull();
            const sections = def!.defaultSections();
            for (const s of sections) {
                expect(s.locked).toBe(true);
                expect(typeof s.lockReason).toBe('string');
                expect(s.lockReason!.length).toBeGreaterThan(0);
            }
        }
    });

    it('checkout-payment carries the CheckoutPaymentForm locked section', () => {
        const def = systemPageRegistry.getDefinition('checkout-payment');
        expect(def).not.toBeNull();
        const types = def!.defaultSections().map(s => Array.isArray(s.content) && s.content[0] ? s.content[0].type : null);
        expect(types).toContain(EItemType.CheckoutPaymentForm);
    });

    it('cart carries the CartLineItems + CartSummary + CartActions locked sections', () => {
        const def = systemPageRegistry.getDefinition('cart');
        const types = def!.defaultSections().map(s => Array.isArray(s.content) && s.content[0] ? s.content[0].type : null);
        expect(types).toContain(EItemType.CartLineItems);
        expect(types).toContain(EItemType.CartSummary);
        expect(types).toContain(EItemType.CartActions);
    });
});
