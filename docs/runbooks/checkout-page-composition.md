# Composing checkout pages

Phase 1.D (checkout-as-composable-page) turns the cart + checkout flow
into composable system pages. Operators can insert trust / marketing
modules between the locked transactional sections without touching
code.

## Adding TrustBadges to the payment page

1. Open `/admin/content/system-pages`.
2. Find the `checkout-payment` row → click the row title to open the
   underlying Navigation page edit view (existing Layout / Pages
   admin).
3. The edit view shows 4 sections — three are marked locked
   (CheckoutProgressBar, CheckoutPaymentForm, PlaceOrderButton,
   CheckoutCartSummary). Add a new section between them.
4. Pick the `TrustBadges` module from the module picker.
5. Save. The storefront page renders TrustBadges on the next request.

## Resetting a system page to defaults

1. Open `/admin/content/system-pages`.
2. Find the row → click "Reset to default".
3. Sonner asks to confirm (destructive). Confirm.
4. Any operator-added composable sections are removed. Locked sections
   are unchanged.

## What happens on upgrade

When a new locked module type ships in a future Phase, the
`SystemPageRegistry`'s `defaultSections()` factory is updated.
Bootstrap on the next deploy:

- Skips operator-edited rows (preserves their composable additions).
- Adds the new locked section ONLY when the row's sections list is
  empty (corruption recovery). Otherwise, operators must add it
  manually — explicit per the Q9 decision.

A future "diff against current default" admin affordance is on the
roadmap.

## MCP usage

```
systemPages.list                       # discover keys + state
systemPages.definition.get             # registry default for one key
systemPages.update { systemKey, sections }
                                       # write; rejects locked-section removals
systemPages.reset { systemKey }        # restore defaults
systemPages.preview { systemKey }      # server-render snapshot
```

## Troubleshooting

- **"section.locked.X" appears as raw key on the storefront** → add
  the corresponding translation entry to `ui/admin/i18n/en.json` (and
  `lv.json` etc.). The fallback for an unresolved key is the key
  itself.
- **A reset doesn't restore the original section order** → reset
  rewrites the section ids on the Navigation row; Sections themselves
  are recreated. Check the audit log under `mcp:systemPages.reset:ok`.
