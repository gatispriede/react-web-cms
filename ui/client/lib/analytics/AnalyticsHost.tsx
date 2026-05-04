import React from 'react';
import {useAutoPageview} from './useAutoPageview';

/**
 * Mount-and-forget host that wires `useAutoPageview` into the app tree.
 * Renders nothing. Add to `_app.tsx` alongside the other invisible hosts
 * (`InlineTranslationHost`, `PresenceHost`).
 *
 * Honours the privacy opt-out built into `track.ts` — `Sec-GPC` /
 * `navigator.doNotTrack` set → no events flushed.
 */
const AnalyticsHost: React.FC = () => {
    useAutoPageview();
    return null;
};

export default AnalyticsHost;
