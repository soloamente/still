import { auth } from "@still/auth";
import { setDbConnectionString } from "@still/db";

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
	HYPERDRIVE?: { connectionString: string };
	ASSETS?: AssetsBucket;
	MEDIA?: MediaBucket;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		setDbConnectionString(env.HYPERDRIVE?.connectionString);
		setAssetsBucket(env.ASSETS ?? null);
		setMediaBucket(env.MEDIA ?? null);
		// Hand Better Auth the raw request BEFORE Elysia — Elysia consumes the
		// body to populate `ctx.body`, and on workerd request bodies are
		// single-use, which breaks `auth.handler` ("Body has already been used").
		const url = new URL(request.url);
		if (url.pathname.startsWith("/api/auth/")) {
			return auth.handler(request);
		}
		return app.fetch(request);
	},
};
