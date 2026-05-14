import { treaty } from "@elysiajs/eden";
import type { App } from "server/app";

/**
 * Browser-friendly typed client. We pass the App type from the server so
 * every route, body, and response is statically known.
 *
 * The default base URL points at `NEXT_PUBLIC_SERVER_URL` (web) or
 * `EXPO_PUBLIC_SERVER_URL` (native). Callers can also pass `baseURL`
 * for SSR/handler usage where `cookies()` need to be forwarded.
 */
export type StillClient = ReturnType<typeof treaty<App>>;

export function createClient(opts: {
  baseURL: string;
  /** Cookies/auth headers to forward (useful for RSC fetches). */
  headers?: Record<string, string>;
  /** Optional fetch override (for Next's cache-tag aware fetcher). */
  fetcher?: typeof fetch;
}): StillClient {
  return treaty<App>(opts.baseURL, {
    fetch: { credentials: "include" },
    headers: opts.headers,
    fetcher: opts.fetcher,
  });
}

export type { App } from "server/app";
