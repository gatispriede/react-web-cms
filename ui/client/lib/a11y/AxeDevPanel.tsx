/**
 * AxeDevPanel — dev-only floating accessibility panel.
 *
 * Wave 8a (WCAG 2.2 AA audit). Project-wide e2e is deferred, so instead of
 * the spec's `@axe-core/playwright` integration we ship a runtime panel
 * that calls `axe-core` against the current document on demand. Live
 * feedback for the operator while iterating on themes / modules; no CI
 * blocker, no e2e dependency.
 *
 * Gating:
 *   - mounted only when `process.env.NODE_ENV !== 'production'` (see
 *     `_app.tsx`). Tree-shaken out of the prod bundle entirely because
 *     the import sits behind a typeof-guard there.
 *   - dynamic-imports `axe-core` so the dev bundle only pays the ~120 kB
 *     cost when the operator opens the panel.
 *
 * Affordances:
 *   - floating button bottom-right; click to expand the panel
 *   - "Run audit" button — runs `axe.run(document)` with WCAG 2.2 AA tags
 *     + emits violations grouped by impact (critical → minor)
 *   - violation rows include the rule id + a count of nodes; click a row
 *     to log the matching DOM nodes to the console (for inspection in
 *     devtools).
 *
 * Manual SR / keyboard passes still happen wall-clock. This panel is the
 * fast-feedback loop in between, not a substitute.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'next-i18next/pages';

type Impact = 'critical' | 'serious' | 'moderate' | 'minor' | null | undefined;

interface AxeViolationNode {
    target: string[];
    html: string;
}

interface AxeViolation {
    id: string;
    impact: Impact;
    description: string;
    help: string;
    helpUrl: string;
    nodes: AxeViolationNode[];
}

interface AxeResultsLike {
    violations: AxeViolation[];
}

const IMPACT_ORDER: Array<NonNullable<Impact>> = ['critical', 'serious', 'moderate', 'minor'];

const IMPACT_COLORS: Record<NonNullable<Impact>, string> = {
    critical: '#b80000',
    serious:  '#d35400',
    moderate: '#b8860b',
    minor:    '#777',
};

function panelStyle(open: boolean): React.CSSProperties {
    return {
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 99999,
        width: open ? 380 : 'auto',
        maxHeight: open ? '70vh' : 'auto',
        background: '#111',
        color: '#eee',
        borderRadius: 8,
        boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    };
}

export default function AxeDevPanel(): React.ReactElement | null {
    const {t} = useTranslation('common');
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [results, setResults] = useState<AxeResultsLike | null>(null);
    const [error, setError] = useState<string | null>(null);

    // SSR / non-browser guard. AxeDevPanel renders only after mount so
    // `document` is always defined inside `runAudit`.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const runAudit = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const axe = await import('axe-core');
            const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
            const out = await axe.default.run(document, {runOnly: {type: 'tag', values: tags}});
            setResults({violations: out.violations as unknown as AxeViolation[]});
        } catch (e: unknown) {
            setError((e as Error)?.message || String(e));
        } finally {
            setBusy(false);
        }
    }, []);

    const grouped = useMemo(() => {
        const map = new Map<NonNullable<Impact>, AxeViolation[]>();
        for (const k of IMPACT_ORDER) map.set(k, []);
        for (const v of results?.violations ?? []) {
            const k: NonNullable<Impact> = (v.impact as NonNullable<Impact>) || 'minor';
            map.get(k)?.push(v);
        }
        return map;
    }, [results]);

    const totalViolations = results?.violations?.length ?? 0;

    if (!mounted) return null;

    const labels = {
        toggle: t('a11y.axe.toggle', 'A11y'),
        title: t('a11y.axe.title', 'Accessibility audit (axe-core)'),
        run: t('a11y.axe.run', 'Run audit'),
        running: t('a11y.axe.running', 'Running…'),
        none: t('a11y.axe.none', 'No violations on this page.'),
        idle: t('a11y.axe.idle', 'Click "Run audit" to scan the current page.'),
        close: t('a11y.axe.close', 'Close'),
    };

    return (
        <div data-testid="axe-dev-panel" style={panelStyle(open)}>
            {!open && (
                <button
                    type="button"
                    data-testid="axe-dev-panel-open"
                    onClick={() => setOpen(true)}
                    style={{
                        padding: '8px 12px',
                        background: '#111',
                        color: '#eee',
                        border: '1px solid #444',
                        borderRadius: 8,
                        cursor: 'pointer',
                    }}
                    title={labels.title}
                >
                    {labels.toggle}{totalViolations > 0 ? ` (${totalViolations})` : ''}
                </button>
            )}
            {open && (
                <>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#000'}}>
                        <strong style={{fontSize: 12}}>{labels.title}</strong>
                        <button
                            type="button"
                            data-testid="axe-dev-panel-close"
                            onClick={() => setOpen(false)}
                            style={{background: 'transparent', color: '#bbb', border: 'none', cursor: 'pointer'}}
                            aria-label={labels.close}
                        >
                            ×
                        </button>
                    </div>
                    <div style={{padding: 10, display: 'flex', gap: 8, alignItems: 'center'}}>
                        <button
                            type="button"
                            data-testid="axe-dev-panel-run"
                            onClick={runAudit}
                            disabled={busy}
                            style={{
                                padding: '6px 10px',
                                background: '#1677ff',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                cursor: busy ? 'wait' : 'pointer',
                            }}
                        >
                            {busy ? labels.running : labels.run}
                        </button>
                        {results && (
                            <span data-testid="axe-dev-panel-count" style={{color: totalViolations === 0 ? '#5a5' : '#f55'}}>
                                {totalViolations === 0 ? labels.none : `${totalViolations} violation(s)`}
                            </span>
                        )}
                    </div>
                    <div data-testid="axe-dev-panel-results" style={{padding: '0 10px 10px', overflowY: 'auto', flex: 1}}>
                        {error && <div style={{color: '#f55'}}>{error}</div>}
                        {!results && !error && <div style={{color: '#888'}}>{labels.idle}</div>}
                        {results && IMPACT_ORDER.map(impact => {
                            const list = grouped.get(impact) ?? [];
                            if (list.length === 0) return null;
                            return (
                                <div key={impact} style={{marginTop: 8}}>
                                    <div style={{color: IMPACT_COLORS[impact], fontWeight: 600, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5}}>
                                        {impact} ({list.length})
                                    </div>
                                    {list.map(v => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            data-testid={`axe-dev-panel-violation-${v.id}`}
                                            onClick={() => {
                                                 
                                                console.groupCollapsed(`[axe] ${v.id} — ${v.help}`);
                                                 
                                                console.log(v.helpUrl);
                                                for (const n of v.nodes) {
                                                     
                                                    console.log(n.target.join(' '), document.querySelector(n.target[0] ?? ''));
                                                }
                                                 
                                                console.groupEnd();
                                            }}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                textAlign: 'left',
                                                background: '#1a1a1a',
                                                color: '#eee',
                                                border: '1px solid #2a2a2a',
                                                borderLeft: `3px solid ${IMPACT_COLORS[impact]}`,
                                                borderRadius: 4,
                                                padding: '6px 8px',
                                                margin: '4px 0',
                                                cursor: 'pointer',
                                                fontSize: 11,
                                            }}
                                        >
                                            <div style={{fontWeight: 600}}>{v.id}</div>
                                            <div style={{color: '#aaa'}}>{v.help} — {v.nodes.length} node(s)</div>
                                        </button>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
