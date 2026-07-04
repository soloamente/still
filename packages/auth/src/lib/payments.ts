import { Polar } from "@polar-sh/sdk";
import { env } from "@still/env/server";

/** Shared Polar SDK client — only instantiated when billing is configured. */
export const polarClient = env.POLAR_ACCESS_TOKEN
	? new Polar({
			accessToken: env.POLAR_ACCESS_TOKEN,
			server: env.POLAR_SERVER === "production" ? "production" : "sandbox",
		})
	: null;
