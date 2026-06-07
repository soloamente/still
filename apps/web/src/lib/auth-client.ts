import { polarClient } from "@polar-sh/better-auth";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Same-origin auth: `next.config` rewrites `/api/auth/*` to the Elysia server.
 * Cookies are stored on the web host so `proxy.ts` and RSC session checks work.
 *
 * `adminClient` exposes the admin plugin's client methods and adds `role` /
 * `banned` to the session payload. We intentionally use the BARE form (no
 * `ac`/`roles`): `@still/auth/permissions` is not a declared dependency of
 * `apps/web` and does not resolve here, so staff gating is done purely on the
 * `role` string from the session (see `(app)/staff/page.tsx`).
 */
export const authClient = createAuthClient({
	plugins: [polarClient(), adminClient()],
});
