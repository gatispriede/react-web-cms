import React from 'react';
import type {CookieConsentBannerProps} from './CookieConsentBanner.types';
import './CookieConsentBanner.scss';

// Forward-stub for Wave 8b — prop contract is locked so call sites can compile today; real consent flow lands later.

export type {ConsentCategory, ConsentDecision, CookieConsentBannerProps} from './CookieConsentBanner.types';

const CookieConsentBanner: React.FC<CookieConsentBannerProps> = () => null;

export default CookieConsentBanner;
export {CookieConsentBanner};
