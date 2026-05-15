/**
 * Performance RUM beacon — W8d.
 *
 * Captures Core Web Vitals (LCP, CLS, INP, TTFB, FCP) on real visits and
 * POSTs a 10 % sample to `/api/perf-beacon`. Beacons fire once per
 * pageview per metric; `web-vitals` itself buffers until the metric is
 * finalised (LCP on first scroll/input or page hide, CLS on page hide).
 *
 * The beacon is intentionally tiny — no batching, no retry — because:
 *   - `navigator.sendBeacon` already survives page unload
 *   - the sample rate is 10 %, so dropped requests don't skew p75
 *     beyond noise floor
 *   - re-queueing a beacon risks a feedback loop when the API is down
 *
 * `web-vitals` is loaded lazily so it doesn't end up in the homepage
 * critical bundle. Bundle-size gate enforces this — the beacon module
 * itself stays under 1 kB before the dynamic import.
 *
 * Privacy: honours Sec-GPC + DNT identically to the analytics tracker —
 * no beacons fire when the visitor opted out. Path is captured; no
 * query string, no fragment, no identifying info.
 */

const SAMPLE_RATE = 0.1;

type WebVitalsMetric = {
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    id: string;
};

function privacyOptOut(): boolean {
    if (typeof navigator === 'undefined') return false;
    const gpc = (navigator as unknown as {globalPrivacyControl?: boolean}).globalPrivacyControl === true;
    const dnt = navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes';
    return gpc || dnt;
}

function send(metric: WebVitalsMetric): void {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({
        name: metric.name,
        value: Math.round(metric.value * 1000) / 1000,
        rating: metric.rating,
        path: window.location.pathname,
        ts: Date.now(),
    });
    // `sendBeacon` is fire-and-forget + survives page unload; perfect
    // for CLS/LCP which finalise at pagehide. Fall back to fetch when
    // unavailable (older Safari).
    try {
        if ('sendBeacon' in navigator) {
            const blob = new Blob([payload], {type: 'application/json'});
            navigator.sendBeacon('/api/perf-beacon', blob);
            return;
        }
        void fetch('/api/perf-beacon', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: payload,
            keepalive: true,
        });
    } catch {
        // Beacon path must never throw into the host page.
    }
}

let started = false;

/**
 * Idempotent — safe to call from any client mount. Returns immediately on
 * the server, on repeat invocations, or when the visitor opted out of
 * sampling. Loads `web-vitals` lazily so it never lands in the critical
 * bundle.
 */
export function startPerfBeacon(): void {
    if (started) return;
    if (typeof window === 'undefined') return;
    if (privacyOptOut()) return;
    if (Math.random() > SAMPLE_RATE) return;
    started = true;

    // Dynamic import — `web-vitals` stays out of the entry bundle. If the
    // module fails to load (CDN block, offline) the page is unaffected.
    void import('web-vitals')
        .then((mod) => {
            const reg = (fn?: (cb: (m: WebVitalsMetric) => void) => void) => {
                if (typeof fn === 'function') fn(send);
            };
            reg((mod as any).onLCP);
            reg((mod as any).onCLS);
            reg((mod as any).onINP);
            reg((mod as any).onTTFB);
            reg((mod as any).onFCP);
        })
        .catch(() => { /* swallowed — beacon is best-effort */ });
}
