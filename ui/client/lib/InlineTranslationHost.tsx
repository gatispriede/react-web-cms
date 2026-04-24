import React, {useEffect, useState} from 'react';
import {useSession} from 'next-auth/react';
import SiteFlagsApi from '@services/api/client/SiteFlagsApi';
import InlineTranslationEditor from './InlineTranslationEditor';
import {refreshBus} from '@client/lib/refreshBus';

/**
 * Mounts the Alt-click translation editor on the public site **and** sets
 * the body attribute that gates the CSS hover affordance. Intentionally a
 * single host mounted once at `_app` level so the editor works no matter
 * which page the admin is viewing — admin chrome, the public site, or a
 * blog post.
 *
 * Gated by:
 *   - Session role ≥ editor (so viewers don't accidentally open the editor)
 *   - `siteFlags.inlineTranslationEdit === true` (opt-in per site)
 */
export const InlineTranslationHost: React.FC = () => {
    const {data: session} = useSession();
    const [enabled, setEnabled] = useState(false);

    const role = (session?.user as any)?.role as 'viewer' | 'editor' | 'admin' | undefined;
    const canEdit = role === 'editor' || role === 'admin';

    useEffect(() => {
        if (!canEdit) { setEnabled(false); return; }
        let cancelled = false;
        const refresh = async () => {
            try {
                const flags = await new SiteFlagsApi().get();
                if (!cancelled) setEnabled(Boolean(flags.inlineTranslationEdit));
            } catch { /* noop */ }
        };
        void refresh();
        const off = refreshBus.subscribe(refresh, 'settings');
        return () => { cancelled = true; off(); };
    }, [canEdit]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (enabled) document.body.setAttribute('data-admin-inline-edit', 'true');
        else document.body.removeAttribute('data-admin-inline-edit');
        return () => document.body.removeAttribute('data-admin-inline-edit');
    }, [enabled]);

    if (!enabled) return null;
    return <InlineTranslationEditor/>;
};

export default InlineTranslationHost;
