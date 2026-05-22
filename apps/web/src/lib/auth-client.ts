import { polarClient } from "@polar-sh/better-auth";
import { createAuthClient } from "better-auth/react";

/**
 * Same-origin auth: `next.config` rewrites `/api/auth/*` to the Elysia server.
 * Cookies are stored on the web host so `proxy.ts` and RSC session checks work.
 */
export const authClient = createAuthClient({
	plugins: [polarClient()],
});
