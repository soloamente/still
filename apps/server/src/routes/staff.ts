import { auth } from "@still/auth";
import { permissionSummary } from "@still/auth/permission-summary";
import type { AppRole } from "@still/auth/permissions";
import {
	db,
	list,
	log,
	post,
	profile,
	review,
	staffAuditLog,
	user,
} from "@still/db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context, requirePermission } from "../context";
import { forwardAuthSetCookies } from "../lib/forward-auth-set-cookies";
import { HANDLE_RE } from "../lib/handle-re";
import { hit } from "../lib/rate-limit";
import { notifyRoleChanged } from "../lib/role-change-notification";
import { type AuditTargetType, writeAuditLog } from "../lib/staff-audit";
import { outranks } from "../lib/staff-rank";
import { addStaffUserNote, listStaffUserNotes } from "../lib/staff-user-notes";
import { fetchStaffUserActivityStats } from "../lib/staff-user-stats";

const CONTENT_TABLES = { review, log, list, post } as const;
type ContentType = keyof typeof CONTENT_TABLES;

const EDITABLE_PROFILE_FIELDS = [
	"displayName",
	"handle",
	"bio",
	"pronouns",
	"location",
	"website",
	"bannerUrl",
	"accentColor",
] as const;
type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];

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
	.get("/users/:id", async ({ user: viewer, params, status }) => {
		try {
			await requirePermission({ user: viewer }, { user: ["list"] });
		} catch (e) {
			return forbidden(status, e);
		}
		if (!viewer) return status(401, "Sign in");
		// Read-only detail view: intentionally no audit-log entry here.
		// Sensitive mutations on this user (edit/pro/notes/impersonate) are
		// audited by their own endpoints.
		const [target] = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				role: user.role,
				banned: user.banned,
				banExpires: user.banExpires,
				emailVerified: user.emailVerified,
				createdAt: user.createdAt,
			})
			.from(user)
			.where(eq(user.id, params.id));
		if (!target) return status(404, "User not found");

		const [targetProfile] = await db
			.select({
				userId: profile.userId,
				handle: profile.handle,
				displayName: profile.displayName,
				bio: profile.bio,
				pronouns: profile.pronouns,
				location: profile.location,
				website: profile.website,
				bannerUrl: profile.bannerUrl,
				accentColor: profile.accentColor,
				isPro: profile.isPro,
				isPrivate: profile.isPrivate,
			})
			.from(profile)
			.where(eq(profile.userId, params.id));

		const activityStats = targetProfile
			? await fetchStaffUserActivityStats(params.id)
			: null;

		const role = (target.role ?? "user") as AppRole;
		return {
			user: target,
			profile: targetProfile
				? { ...targetProfile, statsCache: activityStats }
				: null,
			permissions: permissionSummary(role),
		};
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
		"/users/:id/edit",
		async ({ user: viewer, params, body, status }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["edit"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			if (!hit(`staff:edit:${viewer.id}`, { limit: 30, windowMs: 60_000 }).ok) {
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

			const setValues: Record<string, unknown> = {};
			const changedFields: EditableProfileField[] = [];
			for (const field of EDITABLE_PROFILE_FIELDS) {
				const value = body[field];
				if (value === undefined) continue;
				if (field === "handle") {
					const desired = value.toLowerCase();
					if (!HANDLE_RE.test(desired)) {
						return status(400, "Invalid handle format");
					}
					const [taken] = await db
						.select({ userId: profile.userId })
						.from(profile)
						.where(
							and(
								eq(profile.handle, desired),
								sql`${profile.userId} <> ${params.id}`,
							),
						);
					if (taken) return status(409, "Handle already taken");
					setValues.handle = desired;
				} else {
					setValues[field] = value;
				}
				changedFields.push(field);
			}
			if (changedFields.length === 0) {
				return status(400, "No fields to update");
			}
			setValues.updatedAt = new Date();

			const updated = await db
				.update(profile)
				.set(setValues)
				.where(eq(profile.userId, params.id))
				.returning({ userId: profile.userId });
			if (updated.length === 0) return status(404, "Profile not found");

			// Log which fields changed, not their before/after values — full
			// diffs would put PII (bios, locations, websites) in the audit log.
			await writeAuditLog({
				actorId: viewer.id,
				action: "user.edit",
				targetType: "user",
				targetId: params.id,
				metadata: { changedFields },
			});
			return { ok: true };
		},
		{
			body: t.Object({
				displayName: t.Optional(t.String({ maxLength: 80 })),
				handle: t.Optional(t.String({ maxLength: 24 })),
				bio: t.Optional(t.String({ maxLength: 500 })),
				pronouns: t.Optional(t.String({ maxLength: 40 })),
				location: t.Optional(t.String({ maxLength: 80 })),
				website: t.Optional(t.String({ maxLength: 200 })),
				bannerUrl: t.Optional(t.String({ maxLength: 1000 })),
				accentColor: t.Optional(t.String({ maxLength: 20 })),
			}),
		},
	)
	.post(
		"/users/:id/pro",
		async ({ user: viewer, params, body, status }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["pro"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
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
			const updated = await db
				.update(profile)
				.set({ isPro: body.isPro, updatedAt: new Date() })
				.where(eq(profile.userId, params.id))
				.returning({ userId: profile.userId });
			if (updated.length === 0) return status(404, "Profile not found");

			await writeAuditLog({
				actorId: viewer.id,
				action: body.isPro ? "user.pro.grant" : "user.pro.revoke",
				targetType: "user",
				targetId: params.id,
			});
			return { ok: true };
		},
		{ body: t.Object({ isPro: t.Boolean() }) },
	)
	.get("/users/:id/notes", async ({ user: viewer, params, status }) => {
		try {
			await requirePermission({ user: viewer }, { user: ["note"] });
		} catch (e) {
			return forbidden(status, e);
		}
		const notes = await listStaffUserNotes(params.id);
		return { notes };
	})
	.post(
		"/users/:id/notes",
		async ({ user: viewer, params, body, status }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["note"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			const note = await addStaffUserNote({
				userId: params.id,
				authorId: viewer.id,
				body: body.body,
			});
			await writeAuditLog({
				actorId: viewer.id,
				action: "user.note.add",
				targetType: "user",
				targetId: params.id,
				metadata: { noteId: note.id },
			});
			return status(201, { note });
		},
		{ body: t.Object({ body: t.String({ minLength: 1, maxLength: 2000 }) }) },
	)
	.post(
		"/users/:id/impersonate",
		async ({ user: viewer, params, status, request, set }) => {
			try {
				await requirePermission({ user: viewer }, { user: ["impersonate"] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			const [target] = await db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.id, params.id));
			if (!target) return status(404, "User not found");

			// No `outranks` gate here, intentionally: `user:impersonate` is granted
			// Owner-only by the access-control matrix, and the Owner must be able
			// to impersonate *any* account — including other Owners — to debug
			// account-specific issues. Gating on rank would block owner-vs-owner.
			const authResult = await auth.api.impersonateUser({
				body: { userId: params.id },
				headers: request.headers,
				returnHeaders: true,
			});
			// Without forwarding Set-Cookie, the browser keeps the staff session and
			// impersonation appears to do nothing after redirect.
			forwardAuthSetCookies(set, authResult.headers);

			await writeAuditLog({
				actorId: viewer.id,
				action: "user.impersonate.start",
				targetType: "user",
				targetId: params.id,
			});
			return { ok: true };
		},
	)
	.post(
		"/stop-impersonating",
		async ({ user: viewer, session, status, request, set }) => {
			if (!viewer || !session) return status(401, "Sign in");
			const realActorId = session.impersonatedBy;
			if (!realActorId) {
				return status(400, "Not currently impersonating");
			}
			const authResult = await auth.api.stopImpersonating({
				headers: request.headers,
				returnHeaders: true,
			});
			forwardAuthSetCookies(set, authResult.headers);

			await writeAuditLog({
				actorId: realActorId,
				action: "user.impersonate.stop",
				targetType: "user",
				targetId: viewer.id,
			});
			return { ok: true };
		},
	)
	.post(
		"/content/:type/:id/:op",
		async ({ user: viewer, params, body, status }) => {
			const { type, id, op } = params as {
				type: string;
				id: string;
				op: "hide" | "delete" | "restore" | "mark-spoiler" | "unmark-spoiler";
			};
			if (!(type in CONTENT_TABLES)) return status(400, "Unknown content type");
			const isSpoilerOp = op === "mark-spoiler" || op === "unmark-spoiler";
			if (
				![
					"hide",
					"delete",
					"restore",
					"mark-spoiler",
					"unmark-spoiler",
				].includes(op)
			) {
				return status(400, "Unknown operation");
			}
			if (isSpoilerOp && type !== "review") {
				return status(400, "Spoiler marking only applies to reviews");
			}
			// Spoiler flags use the same staff gate as hide — support can mask
			// unmarked spoiler reviews without delete/restore powers.
			const permAction =
				op === "restore" ? "restore" : isSpoilerOp ? "hide" : op;
			try {
				await requirePermission({ user: viewer }, { content: [permAction] });
			} catch (e) {
				return forbidden(status, e);
			}
			if (!viewer) return status(401, "Sign in");
			if (!hit(`staff:mod:${viewer.id}`, { limit: 60, windowMs: 60_000 }).ok) {
				return status(429, "Slow down");
			}
			if (isSpoilerOp) {
				const containsSpoilers = op === "mark-spoiler";
				const updated = await db
					.update(review)
					.set({ containsSpoilers })
					.where(eq(review.id, id))
					.returning({
						id: review.id,
						containsSpoilers: review.containsSpoilers,
					});
				if (updated.length === 0) return status(404, "Content not found");
				await writeAuditLog({
					actorId: viewer.id,
					action: `content.${op}`,
					targetType: "review",
					targetId: id,
					reason: body.reason ?? null,
					metadata: { containsSpoilers },
				});
				return { ok: true, containsSpoilers };
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
