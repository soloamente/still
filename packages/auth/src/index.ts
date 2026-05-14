import { expo } from "@better-auth/expo";
import { polar, checkout, portal } from "@polar-sh/better-auth";
import { createDb } from "@still/db";
import * as schema from "@still/db/schema/auth";
import { env } from "@still/env/server";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { polarClient } from "./lib/payments";

/**
 * The Polar plugin is opt-in: registering it unconditionally means every
 * sign-up tries to create a Polar customer, which 401s the moment the
 * access token is missing or scoped to a different sandbox/org. We only
 * mount it when both required env vars are present.
 */
function buildPolarPlugin(): BetterAuthPlugin | null {
  if (!env.POLAR_ACCESS_TOKEN || !env.POLAR_SUCCESS_URL) return null;
  return polar({
    client: polarClient,
    createCustomerOnSignUp: true,
    enableCustomerPortal: true,
    use: [
      checkout({
        // TODO: replace with the real Polar product id once the Pro tier is
        // provisioned. Until then we still register the plugin (so the
        // customer-creation hook fires) but expose no purchasable products.
        products: [],
        successUrl: env.POLAR_SUCCESS_URL,
        authenticatedUsersOnly: true,
      }),
      portal(),
    ],
  });
}

export function createAuth() {
  const db = createDb();
  const polarPlugin = buildPolarPlugin();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: [
      env.CORS_ORIGIN,
      "still://",
      ...(env.NODE_ENV === "development"
        ? ["exp://", "exp://**", "exp://192.168.*.*:*/**", "http://localhost:8081"]
        : []),
    ],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      // Order matters: expo() must come before any plugin that schedules
      // post-signup work so its session bridge is initialized.
      expo(),
      ...(polarPlugin ? [polarPlugin] : []),
    ],
  });
}

export const auth = createAuth();
