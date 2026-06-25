import { setDbConnectionString } from "@still/db";

import type { AssetsBucket } from "./lib/asset-store";
import { setAssetsBucket } from "./lib/asset-store";
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
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		setDbConnectionString(env.HYPERDRIVE?.connectionString);
		setAssetsBucket(env.ASSETS ?? null);
		return app.fetch(request);
	},
};
