import React, {useEffect, useState} from 'react';
import {Avatar, Tooltip} from 'antd';
import {useSession} from 'next-auth/react';

/**
 * Layer 2 presence UI for multi-admin editing. Heartbeats the caller's
 * session to `/api/presence` every 15 s and polls the peer list on the
 * same cadence, rendering small avatars of other editors active on the
 * same `docId`. Self is filtered by email so the caller doesn't see
 * themselves in the stack.
 *
 * Empty presence (only self) renders nothing — the bar only appears
 * when there's actually a concurrent peer worth warning about, keeping
 * solo editing clean.
 *
 * `docId` is caller-scoped and opaque to the server — the host
 * (`PresenceHost`) passes the current admin route so "I'm also on
 * /admin/settings" shows up regardless of the specific sub-tab.
 */
interface Peer {
    email: string;
    name?: string;
    at: string;
}

const POLL_MS = 15_000;

const initialFor = (p: Peer): string => {
    const src = (p.name || p.email || '?').trim();
    return src.charAt(0).toUpperCase();
};

const colorFor = (email: string): string => {
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 48%)`;
};

export const PresenceBar: React.FC<{docId: string | null}> = ({docId}) => {
    const {data: session} = useSession();
    const selfEmail = session?.user?.email ?? null;
    const role = (session?.user as any)?.role as 'viewer' | 'editor' | 'admin' | undefined;
    const canPresence = role === 'editor' || role === 'admin';
    const [peers, setPeers] = useState<Peer[]>([]);

    useEffect(() => {
        if (!docId || !canPresence) return;
        let cancelled = false;

        const heartbeat = async () => {
            try {
                await fetch('/api/presence', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({docId}),
                });
            } catch { /* silent — presence is non-blocking */ }
        };

        const poll = async () => {
            try {
                const r = await fetch(`/api/presence?docId=${encodeURIComponent(docId)}`);
                if (!r.ok) return;
                const data = await r.json();
                if (cancelled) return;
                const entries: Peer[] = Array.isArray(data?.entries) ? data.entries : [];
                setPeers(entries.filter(p => p.email && p.email !== selfEmail));
            } catch { /* silent */ }
        };

        void heartbeat().then(poll);
        const hbId = window.setInterval(heartbeat, POLL_MS);
        const pollId = window.setInterval(poll, POLL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(hbId);
            window.clearInterval(pollId);
        };
    }, [docId, canPresence, selfEmail]);

    if (!docId || !canPresence || peers.length === 0) return null;

    return (
        <div
            aria-label="Editors active on this page"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.9)',
            }}
        >
            <span style={{fontSize: 11, color: '#666'}}>Also here:</span>
            <Avatar.Group size="small" max={{count: 4}}>
                {peers.map(p => (
                    <Tooltip key={p.email} title={p.name ? `${p.name} (${p.email})` : p.email}>
                        <Avatar size="small" style={{background: colorFor(p.email)}}>
                            {initialFor(p)}
                        </Avatar>
                    </Tooltip>
                ))}
            </Avatar.Group>
        </div>
    );
};

/**
 * Mounts a single `<PresenceBar>` bound to the current admin route path.
 * Good default: "two admins on the same admin URL" signal covers most of
 * the collaborative-editing footprint without threading per-doc ids
 * through every surface. Finer-grained docIds can wrap specific editors
 * later by rendering `<PresenceBar docId={`theme:${id}`}/>` directly.
 */
export const PresenceHost: React.FC = () => {
    const {data: session} = useSession();
    const role = (session?.user as any)?.role as 'viewer' | 'editor' | 'admin' | undefined;
    const [docId, setDocId] = useState<string | null>(null);

    useEffect(() => {
        if (role !== 'editor' && role !== 'admin') { setDocId(null); return; }
        if (typeof window === 'undefined') return;
        const read = () => {
            const p = window.location.pathname;
            // Only track admin surfaces — the public site doesn't benefit
            // from presence (visitors aren't editors).
            setDocId(/\/admin(\b|\/|$)/.test(p) ? `route:${p}` : null);
        };
        read();
        const onPop = () => read();
        window.addEventListener('popstate', onPop);
        // Next.js SPA navigations don't fire popstate; patch pushState too.
        const origPush = window.history.pushState;
        window.history.pushState = function (...args: any[]) {
            const r = origPush.apply(this, args as any);
            read();
            return r;
        };
        return () => {
            window.removeEventListener('popstate', onPop);
            window.history.pushState = origPush;
        };
    }, [role]);

    if (!docId) return null;
    return (
        <div style={{position: 'fixed', top: 12, right: 16, zIndex: 500}}>
            <PresenceBar docId={docId}/>
        </div>
    );
};

export default PresenceBar;
