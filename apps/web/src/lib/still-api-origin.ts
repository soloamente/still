import { env } from "@still/env/web";

/**
 * Base origin for `/api/*` fetches.
 *
 * In the browser we always use `window.location.origin` so Better Auth session
 * cookies (set on the web app host via the `/api/auth` rewrite) are included.
 * If `NEXT_PUBLIC_SERVER_URL` points at the standalone API host, cross-origin
 * calls return 401 even when the user is signed in.
 *
 * On the server we use `NEXT_PUBLIC_SERVER_URL`, which must be the public **web**
 * URL (same host users open in the browser), not the API deployment.
 */
export function stillApiOrigin(): string {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}
	return env.NEXT_PUBLIC_SERVER_URL;
}
