/**
 * Bun preload that redirects the Neon HTTP driver at a local proxy.
 *
 * `@still/db` builds its client with `@neondatabase/serverless` `neon()`, whose
 * HTTP transport normally targets a Neon endpoint. In local development we run
 * `scripts/dev/neon-http-proxy.mjs` in front of a local Postgres and point the
 * driver at it here.
 *
 * Inert unless `NEON_LOCAL_PROXY` is set, so it has no effect on tests, CI,
 * Vercel, or Cloudflare Workers — only the Cloud Agent / local dev terminal
 * that opts in by exporting `NEON_LOCAL_PROXY=http://127.0.0.1:4444/sql`.
 */
import { neonConfig } from "@neondatabase/serverless";

const endpoint = process.env.NEON_LOCAL_PROXY?.trim();
if (endpoint) {
	// Full endpoint URL (protocol + host + /sql path). The proxy ignores the
	// per-request connection string and talks to the local DATABASE_URL.
	neonConfig.fetchEndpoint = endpoint;
	// Local proxy is plain HTTP; disable the driver's HTTPS assumptions.
	neonConfig.useSecureWebSocket = false;
	neonConfig.poolQueryViaFetch = true;
	console.info(`[neon-local-preload] fetchEndpoint -> ${endpoint}`);
}
