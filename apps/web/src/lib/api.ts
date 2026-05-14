import { createClient } from "@still/api-client";
import { env } from "@still/env/web";

/**
 * Browser-side singleton — uses the Better Auth cookie via credentials:include.
 * Use directly from "use client" components and route handlers; for RSC
 * fetches that need to forward cookies use `serverApi()` instead.
 *
 * Prefer thin `still-api-fetch` helpers for brittle GET URLs (movie search querystring,
 * optional `AbortSignal`).
 */
export const api = createClient({ baseURL: env.NEXT_PUBLIC_SERVER_URL });
