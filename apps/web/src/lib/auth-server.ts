import "server-only";

import { env } from "@still/env/web";
import { cookies, headers } from "next/headers";

/**
 * Session payload returned by Better Auth `GET /api/auth/get-session` when
 * the user is signed in. We keep this minimal to match what the app reads.
 */
export type ServerSession = {
  session: { id: string; userId: string; expiresAt?: Date | string };
  user: {
    id: string;
    name?: string | null;
    email?: string;
    image?: string | null;
    emailVerified?: boolean;
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

    const url = new URL("/api/auth/get-session", env.NEXT_PUBLIC_SERVER_URL);
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
