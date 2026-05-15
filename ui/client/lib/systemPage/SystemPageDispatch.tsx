/**
 * Phase 1.D-c — public-side system-page dispatch.
 *
 * Walks an `ISystemPageSnapshot.defaultSections` payload and renders
 * each section's items via the client-side module registry
 * (`CLIENT_ITEM_TYPES`). This is the public counterpart to the heavy
 * admin-aware `<SectionContent>` host — no edit overlays, no merge /
 * split chips, no drag handles. Just a thin grid wrapper per section
 * so the layout matches what the operator built in the admin.
 *
 * The 6 refactored checkout-family routes mount this as their only
 * render path; per-route presentational legacy (forms, redirects,
 * `useCheckoutMachine` glue) lives in the locked modules themselves
 * (`CheckoutAddressForm`, `CheckoutPaymentForm`, …) — modules are
 * responsible for their own client behaviour now. The route becomes
 * a thin loader + a single `<SystemPageDispatch>` call.
 */
import React from 'react';
import {TFunction} from 'i18next';
import {CLIENT_ITEM_TYPES} from '@client/modules/clientItemTypes';
import {EItemType} from '@enums/EItemType';
import type {ISection} from '@interfaces/ISection';
import type {IItem} from '@interfaces/IItem';

const DISPLAYS: ReadonlyMap<string, React.ComponentType<{item: IItem; t: TFunction<'translation', undefined>; tApp: TFunction<string, undefined>; admin?: boolean}>> =
    new Map(CLIENT_ITEM_TYPES.map(c => [c.key as string, c.Display as never]));

export interface ISystemPageDispatchProps {
    /** SSR-loaded section list — typically `snapshot.defaultSections`. */
    sections: ISection[];
    /** App + framework t() pair — most public modules ignore them but
     *  the renderer contract is `{item, t, tApp, admin}` so we pass both. */
    t: TFunction<'translation', undefined>;
    tApp: TFunction<string, undefined>;
    /** Optional test marker — lets e2e specs assert system-page dispatch
     *  fired for a given `systemKey`. */
    systemKey?: string;
}

/**
 * Render a flat section list. Each section becomes a grid row whose
 * column count matches the section's `slots` or `.type`; each cell
 * renders a single module via its registered `Display`.
 */
const SystemPageDispatch: React.FC<ISystemPageDispatchProps> = ({sections, t, tApp, systemKey}) => {
    return (
        <div className="system-page-dispatch" data-testid="system-page-dispatch" data-system-key={systemKey}>
            {sections.map((section, sIdx) => {
                const slots = resolveSlots(section);
                const totalUnits = slots.reduce((a, b) => a + b, 0);
                const gridStyle: React.CSSProperties = {
                    display: 'grid',
                    gridTemplateColumns: `repeat(var(--section-cols, ${totalUnits}), 1fr)`,
                    gap: 16,
                    ['--section-cols' as never]: totalUnits as never,
                };
                return (
                    <div
                        key={section.id ?? sIdx}
                        className="section"
                        style={gridStyle}
                        data-testid={`system-page-section-${sIdx}`}
                    >
                        {(section.content ?? []).map((item, idx) => {
                            const span = slots[idx] ?? 1;
                            const Display = DISPLAYS.get(item.type as string);
                            if (!Display || item.type === EItemType.Empty) return null;
                            return (
                                <div
                                    key={idx}
                                    className={`section-item-container section__column ${item.type} span-${span}`}
                                    style={{gridColumn: `span ${span}`, position: 'relative'}}
                                    data-testid={`system-page-module-${String(item.type).toLowerCase().replace(/_/g, '-')}`}
                                >
                                    <Display item={item} t={t} tApp={tApp} admin={false}/>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};

/** Mirror of `SectionContent.resolveSlots` — public-side copy so the
 *  dispatch shim doesn't need the admin import chain. */
function resolveSlots(section: ISection): number[] {
    const fallback = Array(Math.max(1, section.type)).fill(1);
    const raw = section.slots;
    if (!Array.isArray(raw) || raw.length === 0) return fallback;
    if (raw.some(s => typeof s !== 'number' || s < 1)) return fallback;
    const sum = raw.reduce((a, b) => a + b, 0);
    if (sum !== section.type) return fallback;
    return [...raw];
}

export default SystemPageDispatch;
export {SystemPageDispatch};
