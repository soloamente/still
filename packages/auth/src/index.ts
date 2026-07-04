import { expo } from "@better-auth/expo";
import { checkout, polar, portal } from "@polar-sh/better-auth";
import { db } from "@still/db";
import * as schema from "@still/db/schema/auth";
import { env } from "@still/env/server";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin } from "better-auth/plugins";
import type { ReactElement } from "react";

import { DeleteAccountEmail } from "./emails/delete-account";
import { renderAuthEmail } from "./emails/render-email";
import { ResetPasswordEmail } from "./emails/reset-password";
import { VerifyEmail } from "./emails/verify-email";
import { deleteUserBlobAssets } from "./lib/delete-user-cleanup";
import { polarClient } from "./lib/payments";
import { buildPolarCheckoutProducts } from "./lib/polar-checkout-products";
import { sendEmail } from "./lib/send-email";
import { ac, roles } from "./permissions";

/** Render a React Email template and send html + plain-text via Resend. */
async function sendAuthEmail(
	to: string,
	element: ReactElement,
	subject: string,
): Promise<void> {
	const rendered = await renderAuthEmail(element, subject);
	await sendEmail({
		to,
		subject: rendered.subject,
		html: rendered.html,
		text: rendered.text,
	});
}

/**
 * The Polar plugin is opt-in: registering it unconditionally means every
 * sign-up tries to create a Polar customer, which 401s the moment the
 * access token is missing or scoped to a different sandbox/org. We only
 * mount it when both required env vars are present.
 */
function buildPolarPlugin(): BetterAuthPlugin | null {
	if (!env.POLAR_ACCESS_TOKEN || !env.POLAR_SUCCESS_URL || !polarClient) {
		return null;
	}
	return polar({
		client: polarClient,
		createCustomerOnSignUp: true,
		enableCustomerPortal: true,
		use: [
			checkout({
				products: buildPolarCheckoutProducts(),
				successUrl: env.POLAR_SUCCESS_URL,
				authenticatedUsersOnly: true,
			}),
			portal(),
		],
	});
}

export function createAuth() {
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
				? [
						"exp://",
						"exp://**",
						"exp://192.168.*.*:*/**",
						"http://localhost:8081",
					]
				: []),
		],
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			expiresIn: 60 * 60 * 24,
			sendVerificationEmail: async ({ user, url }) => {
				await sendAuthEmail(
					user.email,
					VerifyEmail({ url }),
					"Confirm your email for Sense",
				);
			},
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			sendResetPassword: async ({ user, url }) => {
				await sendAuthEmail(
					user.email,
					ResetPasswordEmail({ url }),
					"Reset your Sense password",
				);
			},
			resetPasswordTokenExpiresIn: 60 * 60,
		},
		user: {
			deleteUser: {
				enabled: true,
				deleteTokenExpiresIn: 60 * 60 * 24, // 24h — matches the email copy
				// Email-verified deletion: the patron clicks a link in their inbox;
				// Better Auth's callback then deletes the user row and DB cascades
				// wipe everything else.
				sendDeleteAccountVerification: async ({ user: target, url }) => {
					await sendAuthEmail(
						target.email,
						DeleteAccountEmail({ url }),
						"Confirm your Sense account deletion",
					);
				},
				beforeDelete: async (target) => {
					await deleteUserBlobAssets(target.id);
				},
			},
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
			adminPlugin({
				ac,
				roles,
				defaultRole: "user",
				// Users holding these roles may call the admin API endpoints.
				adminRoles: ["owner", "admin"],
				// Impersonated sessions auto-expire after 1 hour — better-auth's
				// native time-boxed impersonation (no custom session code needed).
				impersonationSessionDuration: 3600,
			}),
			...(polarPlugin ? [polarPlugin] : []),
		],
	});
}

export const auth = createAuth();
