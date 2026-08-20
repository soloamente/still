import { auth } from "@still/auth";
import type { StaffRole } from "@still/auth/permissions";
import { db } from "@still/db";
import { Elysia } from "elysia";

type ResolvedSession = Awaited<ReturnType<typeof auth.api.getSession>>;

type RequestContext = {
	db: typeof db;
	session: NonNullable<ResolvedSession>["session"] | null;
	user: NonNullable<ResolvedSession>["user"] | null;
};

/**
 * Resolve Better Auth session for a request.
 * Ordinary routes use the signed cookie cache (fewer Neon reads on polling).
 * Security-sensitive routes pass `fresh: true` to bypass the cache.
 */
export async function resolveRequestSession(
	request: Request,
	options: { fresh?: boolean } = {},
): Promise<RequestContext> {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
			...(options.fresh ? { query: { disableCookieCache: true } } : {}),
		});
		const sessionUser = session?.user ?? null;
		// Defense-in-depth: Better Auth's admin plugin already revokes a
		// banned user's sessions, but if one somehow still presents a valid
		// session we treat them as signed out so no authenticated endpoint
		// serves a banned account.
		if (sessionUser && isBanned(sessionUser)) {
			return { db, session: null, user: null };
		}
		return {
			db,
			session: session?.session ?? null,
			user: sessionUser,
		};
	} catch (err) {
		console.error(
			"[context] getSession failed — treating request as signed out",
			err,
		);
		return { db, session: null, user: null };
	}
}

/**
 * Shared Elysia plugin — cached session resolution for hot polling paths.
 * Staff, billing, impersonation, and destructive routes should use
 * `freshContext` instead.
 */
export const context = new Elysia({ name: "context" }).derive(
	{ as: "global" },
	async ({ request }) => resolveRequestSession(request),
);

/**
 * Fresh-session plugin — always validates against Postgres (no cookie cache).
 * Use on staff, billing, impersonation, and destructive data routes.
 */
export const freshContext = new Elysia({ name: "fresh-context" }).derive(
	{ as: "global" },
	async ({ request }) => resolveRequestSession(request, { fresh: true }),
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

type Resource = "user" | "content" | "audit" | "feedback";

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
