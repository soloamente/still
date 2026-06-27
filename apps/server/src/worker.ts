import { auth } from "@still/auth";
import { createRequestDb, runWithRequestDb } from "@still/db";

import type { AssetsBucket } from "./lib/asset-store";
import { setAssetsBucket } from "./lib/asset-store";
import type { MediaBucket } from "./lib/audio-store";
import { setMediaBucket } from "./lib/audio-store";
import { app } from "./server/app";

/**
 * Cloudflare Workers entry. Bindings (Hyperdrive, R2) arrive per-request via
 * `env`; string config arrives through `process.env` (populated by Wrangler
 * vars/secrets under `nodejs_compat`). We wire bindings into the lazy singletons,
 * then hand the request to the Elysia app.
 */
export interface Env {
	HYPERDRIVE: { connectionString: string };
	ASSETS?: AssetsBucket;
	MEDIA?: MediaBucket;
}

type Ctx = { waitUntil: (p: Promise<unknown>) => void };

export default {
	async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
		setAssetsBucket(env.ASSETS ?? null);
		setMediaBucket(env.MEDIA ?? null);

		// Hand Better Auth the raw request BEFORE Elysia — Elysia consumes the
		// body to populate `ctx.body`, and on workerd request bodies are
		// single-use, which breaks `auth.handler` ("Body has already been used").
		const url = new URL(request.url);
		const handle = (): Response | Promise<Response> =>
			url.pathname.startsWith("/api/auth/")
				? auth.handler(request)
				: app.fetch(request);

		// Per-request postgres-js client over Hyperdrive (closed after the
		// response). A persistent module-scoped pool goes stale on workerd.
		const { db, close } = createRequestDb(env.HYPERDRIVE.connectionString);
		try {
			return await runWithRequestDb(db, handle);
		} finally {
			ctx.waitUntil(close());
		}
	},
};
