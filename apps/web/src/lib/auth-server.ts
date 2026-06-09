import "server-only";

import { cookies, headers } from "next/headers";
import { webAppOriginFromHeaders } from "@/lib/auth-request-origin";

/**
 * Session payload returned by Better Auth `GET /api/auth/get-session` when
 * the user is signed in. We keep this minimal to match what the app reads.
 */
export type ServerSession = {
	session: {
		id: string;
		userId: string;
		expiresAt?: Date | string;
		// Present once an Owner starts impersonating this account; carries the
		// real staff member's user id so we can show a banner and let them stop.
		impersonatedBy?: string | null;
	};
	user: {
		id: string;
		name?: string | null;
		email?: string;
		image?: string | null;
		emailVerified?: boolean;
		// Provided by the better-auth admin plugin in the get-session payload.
		role?: string | null;
		banned?: boolean | null;
	};
};

/**
 * Read the current Better Auth session in a Server Component or route handler.
 *
 * We **do not** import `@still/auth` here: that package instantiates Drizzle +
 * `@still/env/server` (DATABASE_URL, secrets, …), which Next.js often does not
 * load for `apps/web`. The Elysia server already runs Better Auth; we forward
 * cookies to its `/api/auth/get-session` endpoint instead.
 */
export async function authServer(): Promise<ServerSession | null> {
	try {
		const store = await cookies();
		const cookieHeader = store
			.getAll()
			.map((c) => `${c.name}=${c.value}`)
			.join("; ");
		if (!cookieHeader) return null;

		const h = await headers();
		const forward: Record<string, string> = { cookie: cookieHeader };
		const origin = h.get("origin");
		const referer = h.get("referer");
		// Better Auth may validate trusted origins; mirror the browser request.
		if (origin) forward.origin = origin;
		if (referer) forward.referer = referer;

		// Same-origin as the browser so session cookies from the `/api` rewrite apply.
		const url = new URL("/api/auth/get-session", webAppOriginFromHeaders(h));
		const res = await fetch(url, {
			headers: forward,
			cache: "no-store",
		});

		if (!res.ok) return null;
		const data = (await res.json()) as ServerSession | null;
		if (!data?.user?.id) return null;
		return data;
	} catch {
		return null;
	}
}
