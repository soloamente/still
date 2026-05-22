import { auth } from "@still/auth";
import { db } from "@still/db";
import { Elysia } from "elysia";

/**
 * Shared Elysia plugin that derives a request context: the Better Auth
 * session (if any), the user, and a handle to the Drizzle DB. Routes
 * that need auth simply call `.guard({ as: 'global' })` or reference
 * the `user` field after calling `.use(context)`.
 */
export const context = new Elysia({ name: "context" }).derive(
	{ as: "global" },
	async ({ request }) => {
		try {
			const session = await auth.api.getSession({ headers: request.headers });
			return {
				db,
				session: session?.session ?? null,
				user: session?.user ?? null,
			};
		} catch (err) {
			console.error(
				"[context] getSession failed — treating request as signed out",
				err,
			);
			return { db, session: null, user: null };
		}
	},
);

/**
 * Helper: throw a 401 if no user is attached. Use as `.derive(authGuard)`
 * or call inside a handler before mutating state.
 */
export function requireUser<T extends { user: unknown }>(
	ctx: T,
): asserts ctx is T & {
	user: NonNullable<T["user"]>;
} {
	if (!ctx.user) {
		throw new Error("UNAUTHORIZED");
	}
}
