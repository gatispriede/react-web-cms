/**
 * Tiny event bus so BuyCta / AddToCartButton can ask the CartDrawer to
 * open without prop-drilling through the entire page tree. Lives behind
 * a typed `subscribe` helper so consumers don't poke at `window`.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function openCartDrawer(): void {
    listeners.forEach(fn => {
        try { fn(); } catch { /* never let one listener block the others */ }
    });
}

export function subscribeCartDrawer(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
