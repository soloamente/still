import { auth } from "@still/auth";
import { db, list, log, post, review, staffAuditLog, user } from "@still/db";
import { desc, eq, ilike, or } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context, requirePermission } from "../context";
import { hit } from "../lib/rate-limit";
import { notifyRoleChanged } from "../lib/role-change-notification";
import { type AuditTargetType, writeAuditLog } from "../lib/staff-audit";
import { outranks } from "../lib/staff-rank";

const CONTENT_TABLES = { review, log, list, post } as const;
type ContentType = keyof typeof CONTENT_TABLES;

// The four content tables share the same soft-removal columns (removedAt /
// removedBy / removalReason) and a text `id`, but their inferred Drizzle types
// differ enough that `db.update(table)` over the union does not typecheck. We
// narrow the looked-up table to one representative member for the update call;
// the runtime value is always the correct table (selected by `:type`).
type ContentTable = (typeof CONTENT_TABLES)[ContentType];
type RepresentativeTable = typeof post;

function forbidden(status: (c: number, m: string) => unknown, e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	if (msg === "UNAUTHORIZED") return status(401, "Sign in");
	if (msg === "FORBIDDEN") return status(403, "Not allowed");
	return status(500, msg);
}

export const staffRoute = new Elysia({ prefix: "/api/staff", tags: ["staff"] })
	.use(context)
	.get("/users", async ({ user: viewer, query, status }) => {
		try {
			await requirePermission({ user: viewer }, { user: ["list"] });
		} catch (e) {
			return forbidden(status, e);
		}
		const q = (query.q ?? "").trim();
		const rows = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				role: user.role,
				banned: user.banned,
				banExpires: user.banExpires,
				createdAt: user.createdAt,
			})
			.from(user)
			.where(
				q
					? or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`))
					: undefined,
			)
			.orderBy(desc(user.createdAt))
			.limit(50);
		return { users: rows };
	})
	.post(
		"/users/:id/ban",
		async ({ user: viewer, params, body, status, request }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["ban"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			if (!hit(`staff:ban:${viewer.id}`, { limit: 30, windowMs: 60_000 }).ok) {
				return status(429, "Slow down");
			}
			const [target] = await db
				.select({ id: user.id, role: user.role })
				.from(user)
				.where(eq(user.id, params.id));
			if (!target) return status(404, "User not found");
			if (!outranks(viewer.role, target.role)) {
				return status(
					403,
					"Cannot act on a peer or higher-ranked staff member",
				);
			}
			await auth.api.banUser({
				body: {
					userId: params.id,
					banReason: body.reason ?? undefined,
					banExpiresIn: body.expiresInSeconds ?? undefined,
				},
				headers: request.headers,
			});
			await writeAuditLog({
				actorId: viewer.id,
				action: "user.ban",
				targetType: "user",
				targetId: params.id,
				reason: body.reason ?? null,
				metadata: { expiresInSeconds: body.expiresInSeconds ?? null },
			});
			return { ok: true };
		},
		{
			body: t.Object({
				reason: t.Optional(t.String({ maxLength: 500 })),
				expiresInSeconds: t.Optional(t.Number()),
			}),
		},
	)
	.post(
		"/users/:id/unban",
		async ({ user: viewer, params, status, request }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["unban"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			await auth.api.unbanUser({
				body: { userId: params.id },
				headers: request.headers,
			});
			await writeAuditLog({
				actorId: viewer.id,
				action: "user.unban",
				targetType: "user",
				targetId: params.id,
			});
			return { ok: true };
		},
	)
	.post(
		"/users/:id/role",
		async ({ user: viewer, params, body, status, request }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["set-role"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			const [target] = await db
				.select({ id: user.id, role: user.role })
				.from(user)
				.where(eq(user.id, params.id));
			if (!target) return status(404, "User not found");
			if (!outranks(viewer.role, target.role) && target.role !== "user") {
				return status(
					403,
					"Cannot change role of a peer or higher staff member",
				);
			}
			await auth.api.setRole({
				body: { userId: params.id, role: body.role },
				headers: request.headers,
			});
			await writeAuditLog({
				actorId: viewer.id,
				action: "user.set-role",
				targetType: "user",
				targetId: params.id,
				metadata: { from: target.role, to: body.role },
			});
			await notifyRoleChanged({
				userId: params.id,
				previousRole: target.role ?? "user",
				newRole: body.role,
			});
			return { ok: true };
		},
		{
			body: t.Object({
				role: t.Union([
					t.Literal("user"),
					t.Literal("support"),
					t.Literal("moderator"),
					t.Literal("admin"),
					t.Literal("owner"),
				]),
			}),
		},
	)
	.post(
		"/content/:type/:id/:op",
		async ({ user: viewer, params, body, status }) => {
			const { type, id, op } = params as {
				type: string;
				id: string;
				op: "hide" | "delete" | "restore";
			};
			if (!(type in CONTENT_TABLES)) return status(400, "Unknown content type");
			if (!["hide", "delete", "restore"].includes(op)) {
				return status(400, "Unknown operation");
			}
			const permAction = op === "restore" ? "restore" : op;
			try {
				await requirePermission({ user: viewer }, { content: [permAction] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			if (!hit(`staff:mod:${viewer.id}`, { limit: 60, windowMs: 60_000 }).ok) {
				return status(429, "Slow down");
			}
			const table: ContentTable = CONTENT_TABLES[type as ContentType];
			const setValues =
				op === "restore"
					? { removedAt: null, removedBy: null, removalReason: null }
					: {
							removedAt: new Date(),
							removedBy: viewer.id,
							removalReason: body.reason ?? null,
						};
			// `table` is the runtime-correct content table; the cast only satisfies
			// the union-vs-single-table type mismatch on `.set()`/`.returning()`.
			const updated = await db
				.update(table as RepresentativeTable)
				.set(setValues)
				.where(eq((table as RepresentativeTable).id, id))
				.returning({ id: (table as RepresentativeTable).id });
			if (updated.length === 0) return status(404, "Content not found");
			await writeAuditLog({
				actorId: viewer.id,
				action: `content.${op}`,
				targetType: type as AuditTargetType,
				targetId: id,
				reason: body.reason ?? null,
			});
			return { ok: true };
		},
		{ body: t.Object({ reason: t.Optional(t.String({ maxLength: 500 })) }) },
	)
	.get("/audit", async ({ user: viewer, query, status }) => {
		try {
			await requirePermission({ user: viewer }, { audit: ["read"] });
		} catch (e) {
			return forbidden(status, e);
		}
		const limit = Math.min(Number(query.limit ?? 100), 200);
		const rows = await db
			.select()
			.from(staffAuditLog)
			.orderBy(desc(staffAuditLog.createdAt))
			.limit(limit);
		return { entries: rows };
	});
