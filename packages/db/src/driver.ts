export type DbDriverChoice = {
	driver: "neon-http" | "postgres-js";
	connectionString: string;
};

/**
 * Pick the DB driver at runtime. Hyperdrive (Workers) provides a pooled
 * Postgres wire-protocol connection string → postgres-js. Everywhere else
 * (Node, Vercel, local dev, tests) falls back to neon-http over `DATABASE_URL`,
 * which is stateless and serverless-safe.
 */
export function resolveDbDriver(opts: {
	hyperdriveConnString: string | undefined;
	databaseUrl: string;
}): DbDriverChoice {
	const hyperdrive = opts.hyperdriveConnString?.trim();
	if (hyperdrive) {
		return { driver: "postgres-js", connectionString: hyperdrive };
	}
	return { driver: "neon-http", connectionString: opts.databaseUrl };
}
