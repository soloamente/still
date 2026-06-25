import { setDbConnectionString } from "@still/db";

import { app } from "./server/app";

/**
 * Cloudflare Workers entry. Bindings (Hyperdrive, R2) arrive per-request via
 * `env`; string config arrives through `process.env` (populated by Wrangler
 * vars/secrets under `nodejs_compat`). We wire Hyperdrive into the lazy `db`
 * singleton, then hand the request to the Elysia app.
 */
export interface Env {
	HYPERDRIVE?: { connectionString: string };
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		setDbConnectionString(env.HYPERDRIVE?.connectionString);
		return app.fetch(request);
	},
};
