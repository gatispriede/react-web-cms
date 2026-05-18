import NextAuth from "next-auth/next";
import {customerAuthOptions} from "./authOptions";

/**
 * Customer NextAuth instance — auth-split-client-admin (Phase 1.A).
 *
 * Cookie `cms.customer-session`. Providers: magic-link primary,
 * credentials optional, plus Google / Facebook / Apple OAuth (each
 * per-provider env-gated). Admin auth runs on a separate instance at
 * `/api/admin/auth/*`.
 *
 * @see ui/client/pages/api/admin/auth/[...nextauth].ts
 * @see docs/architecture/auth-stacks.md
 */
export {customerAuthOptions as authOptions} from "./authOptions";
export default NextAuth(customerAuthOptions);
