import "server-only";

import { createClient } from "@still/api-client";
import { env } from "@still/env/web";
import { cookies } from "next/headers";

/**
 * RSC-safe factory. Forwards the visitor's Better Auth cookie so the
 * server route resolves the same session as the page. Always call inside
 * a Server Component or route handler — never from a client module.
 */
export async function serverApi() {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  return createClient({
    baseURL: env.NEXT_PUBLIC_SERVER_URL,
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    // Next can cache GETs across origins by default; movie detail must reflect latest `tmdbJson` after enrichment.
    fetcher: ((input, init) => fetch(input, { ...init, cache: "no-store" })) as typeof fetch,
  });
}
