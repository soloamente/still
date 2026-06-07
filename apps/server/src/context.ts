import { auth } from "@still/auth";
import type { StaffRole } from "@still/auth/permissions";
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

type Resource = "user" | "content" | "audit";

type HasPermissionOptions = Parameters<typeof auth.api.userHasPermission>[0];

/**
 * Assert the current user is signed in AND holds the given permission for their
 * role. Uses the Better Auth admin plugin's server-side check, which evaluates
 * the same access-control roles registered in `@still/auth`.
 */
export async function requirePermission(
	ctx: { user: { id: string; role?: string | null } | null },
	permission: Partial<Record<Resource, string[]>>,
): Promise<void> {
	if (!ctx.user) throw new Error("UNAUTHORIZED");
	const role = (ctx.user.role ?? "user") as StaffRole | "user";
	if (role === "user") throw new Error("FORBIDDEN");
	// `userHasPermission`'s body type is inferred from the registered access
	// control statements (string-literal action unions per resource); our
	// helper accepts the broader `Partial<Record<Resource, string[]>>` shape
	// for caller convenience, so we narrow it here at the boundary — the
	// runtime values are always valid members of those unions because callers
	// are constrained to `Resource` keys backed by `@still/auth`'s statements.
	const result = await auth.api.userHasPermission({
		body: { role, permissions: permission },
	} as unknown as HasPermissionOptions);
	if (!result?.success) throw new Error("FORBIDDEN");
}

/** Assert the user is staff (any non-`user` role). */
export function requireStaff<
	T extends { user: { role?: string | null } | null },
>(ctx: T): asserts ctx is T & { user: NonNullable<T["user"]> } {
	if (!ctx.user || (ctx.user.role ?? "user") === "user") {
		throw new Error("FORBIDDEN");
	}
}

/** True when a user is currently banned (no expiry, or expiry in the future). */
export function isBanned(
	user: { banned?: boolean | null; banExpires?: Date | string | null } | null,
): boolean {
	if (!user?.banned) return false;
	if (!user.banExpires) return true;
	return new Date(user.banExpires).getTime() > Date.now();
}
