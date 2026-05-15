import NextAuth from 'next-auth/next';
import {adminAuthOptions} from '../../auth/authOptions';

/**
 * Admin NextAuth instance — auth-split-client-admin (Phase 1.A).
 *
 * Disjoint from the customer instance at `/api/auth/*`. Cookie name
 * `cms.admin-session`, `Path=/` (so it rides on `/api/admin/auth/*` —
 * storefront isolation is by cookie *name*, not path). Provider list:
 * admin-credentials
 * + (optionally) admin-google. Session callback emits `kind: 'admin'`
 * + `UserRole` + `canPublishProduction`; admin-only fields never leak
 * onto the customer JWT (and vice versa).
 *
 * @see services/features/Auth/AdminAuthService.ts
 * @see docs/architecture/auth-stacks.md
 */
export default NextAuth(adminAuthOptions);
export {adminAuthOptions as authOptions};
