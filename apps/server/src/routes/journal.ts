import { db, journalPost, profile, user } from "@still/db";
import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context, requireStaff } from "../context";
import {
	communityOffset,
	parseCommunityPage,
} from "../lib/community-page-args";
import { makeId } from "../lib/cuid";
import {
	isValidJournalSlug,
	JOURNAL_STATUS_DRAFT,
	JOURNAL_STATUS_PUBLISHED,
	normalizeJournalSlug,
	parseJournalPageLimit,
} from "../lib/journal-post";
import { routeBody } from "../lib/route-body";

void routeBody;

function mapJournalRow(
	row: typeof journalPost.$inferSelect,
	author?: {
		name: string | null;
		image: string | null;
		handle: string | null;
		displayName: string | null;
	} | null,
) {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		dek: row.dek,
		body: row.body,
		heroImageUrl: row.heroImageUrl,
		authorUserId: row.authorUserId,
		status: row.status,
		publishedAt: row.publishedAt,
		tags: row.tags,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		author: author
			? {
					name: author.displayName ?? author.name,
					handle: author.handle,
					image: author.image,
				}
			: null,
	};
}

async function fetchJournalAuthor(userId: string) {
	const [row] = await db
		.select({
			name: user.name,
			image: user.image,
			handle: profile.handle,
			displayName: profile.displayName,
		})
		.from(user)
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(eq(user.id, userId))
		.limit(1);
	return row ?? null;
}

const journalStatusSchema = t.Union([
	t.Literal(JOURNAL_STATUS_DRAFT),
	t.Literal(JOURNAL_STATUS_PUBLISHED),
]);

const journalCreateBody = t.Object({
	title: t.String({ minLength: 1, maxLength: 200 }),
	slug: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
	dek: t.Optional(t.Union([t.String({ maxLength: 400 }), t.Null()])),
	body: t.String({ minLength: 1 }),
	heroImageUrl: t.Optional(t.Union([t.String({ maxLength: 2048 }), t.Null()])),
	status: t.Optional(journalStatusSchema),
	tags: t.Optional(t.Array(t.String({ maxLength: 48 }))),
});

const journalPatchBody = t.Partial(journalCreateBody);

export const journalRoute = new Elysia({
	prefix: "/api/journal",
	tags: ["journal"],
})
	.use(context)
	.get(
		"/",
		async ({ query }) => {
			const page = parseCommunityPage(query.page);
			const limit = parseJournalPageLimit(query.limit);
			const offset = communityOffset(page, limit);

			const rows = await db
				.select({ post: journalPost })
				.from(journalPost)
				.where(eq(journalPost.status, JOURNAL_STATUS_PUBLISHED))
				.orderBy(desc(journalPost.publishedAt), desc(journalPost.createdAt))
				.limit(limit + 1)
				.offset(offset);

			const hasMore = rows.length > limit;
			const slice = hasMore ? rows.slice(0, limit) : rows;

			return {
				items: slice.map((row) => ({
					id: row.post.id,
					slug: row.post.slug,
					title: row.post.title,
					dek: row.post.dek,
					heroImageUrl: row.post.heroImageUrl,
					publishedAt: row.post.publishedAt,
					tags: row.post.tags,
				})),
				page,
				limit,
				nextPage: hasMore ? page + 1 : null,
			};
		},
		{
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
	.get("/manage", async (ctx) => {
		const { set } = ctx;
		try {
			requireStaff(ctx);
		} catch {
			set.status = 403;
			return { error: "Not allowed" };
		}

		const rows = await db
			.select({ post: journalPost })
			.from(journalPost)
			.orderBy(desc(journalPost.updatedAt), desc(journalPost.createdAt))
			.limit(100);

		const items = await Promise.all(
			rows.map(async (row) => {
				const author = await fetchJournalAuthor(row.post.authorUserId);
				return mapJournalRow(row.post, author);
			}),
		);

		return { items };
	})
	.get(
		"/sitemap",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit ?? 500), 2000);
			const rows = await db
				.select({
					slug: journalPost.slug,
					publishedAt: journalPost.publishedAt,
					updatedAt: journalPost.updatedAt,
				})
				.from(journalPost)
				.where(eq(journalPost.status, JOURNAL_STATUS_PUBLISHED))
				.orderBy(desc(journalPost.publishedAt))
				.limit(limit);

			return {
				entries: rows.map((row) => ({
					slug: row.slug,
					updatedAt: (
						row.updatedAt ??
						row.publishedAt ??
						new Date()
					).toISOString(),
				})),
			};
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	.get(
		"/:slug",
		async ({ params, set }) => {
			const slug = params.slug.toLowerCase();
			const [row] = await db
				.select({ post: journalPost })
				.from(journalPost)
				.where(
					and(
						eq(journalPost.slug, slug),
						eq(journalPost.status, JOURNAL_STATUS_PUBLISHED),
					),
				)
				.limit(1);

			if (!row) {
				set.status = 404;
				return { error: "Not found" };
			}

			const author = await fetchJournalAuthor(row.post.authorUserId);
			return mapJournalRow(row.post, author);
		},
		{ params: t.Object({ slug: t.String() }) },
	)
	.post(
		"/",
		async (ctx) => {
			const { body, set } = ctx;
			try {
				requireStaff(ctx);
			} catch {
				set.status = 403;
				return { error: "Not allowed" };
			}
			const viewer = ctx.user;

			const slug = normalizeJournalSlug(body.slug ?? body.title);
			if (!isValidJournalSlug(slug)) {
				set.status = 400;
				return { error: "Invalid slug" };
			}

			const status = body.status ?? JOURNAL_STATUS_DRAFT;
			const now = new Date();
			const id = makeId("journal");

			try {
				const [created] = await db
					.insert(journalPost)
					.values({
						id,
						slug,
						title: body.title.trim(),
						dek: body.dek?.trim() || null,
						body: body.body,
						heroImageUrl: body.heroImageUrl?.trim() || null,
						authorUserId: viewer.id,
						status,
						publishedAt: status === JOURNAL_STATUS_PUBLISHED ? now : null,
						tags: body.tags ?? [],
						createdAt: now,
						updatedAt: now,
					})
					.returning();

				if (!created) {
					set.status = 500;
					return { error: "Create failed" };
				}

				const author = await fetchJournalAuthor(created.authorUserId);
				return mapJournalRow(created, author);
			} catch (err) {
				if (
					err instanceof Error &&
					err.message.includes("journal_post_slug_uk")
				) {
					set.status = 409;
					return { error: "Slug already in use" };
				}
				throw err;
			}
		},
		{ body: journalCreateBody },
	)
	.patch(
		"/posts/:id",
		async (ctx) => {
			const { body, params, set } = ctx;
			try {
				requireStaff(ctx);
			} catch {
				set.status = 403;
				return { error: "Not allowed" };
			}

			const [existing] = await db
				.select()
				.from(journalPost)
				.where(eq(journalPost.id, params.id))
				.limit(1);

			if (!existing) {
				set.status = 404;
				return { error: "Not found" };
			}

			const nextStatus = body.status ?? existing.status;
			const slug =
				body.slug != null
					? normalizeJournalSlug(body.slug)
					: body.title != null
						? normalizeJournalSlug(body.title)
						: existing.slug;

			if (body.slug != null || body.title != null) {
				if (!isValidJournalSlug(slug)) {
					set.status = 400;
					return { error: "Invalid slug" };
				}
			}

			const now = new Date();
			const publishedAt =
				nextStatus === JOURNAL_STATUS_PUBLISHED
					? (existing.publishedAt ?? now)
					: nextStatus === JOURNAL_STATUS_DRAFT
						? null
						: existing.publishedAt;

			try {
				const [updated] = await db
					.update(journalPost)
					.set({
						...(body.title != null ? { title: body.title.trim() } : {}),
						...(body.slug != null || body.title != null ? { slug } : {}),
						...(body.dek !== undefined
							? { dek: body.dek?.trim() || null }
							: {}),
						...(body.body != null ? { body: body.body } : {}),
						...(body.heroImageUrl !== undefined
							? { heroImageUrl: body.heroImageUrl?.trim() || null }
							: {}),
						...(body.status != null ? { status: body.status } : {}),
						...(body.tags != null ? { tags: body.tags } : {}),
						publishedAt,
						updatedAt: now,
					})
					.where(eq(journalPost.id, params.id))
					.returning();

				if (!updated) {
					set.status = 404;
					return { error: "Not found" };
				}

				const author = await fetchJournalAuthor(updated.authorUserId);
				return mapJournalRow(updated, author);
			} catch (err) {
				if (
					err instanceof Error &&
					err.message.includes("journal_post_slug_uk")
				) {
					set.status = 409;
					return { error: "Slug already in use" };
				}
				throw err;
			}
		},
		{
			params: t.Object({ id: t.String() }),
			body: journalPatchBody,
		},
	)
	.delete(
		"/posts/:id",
		async (ctx) => {
			const { params, set } = ctx;
			try {
				requireStaff(ctx);
			} catch {
				set.status = 403;
				return { error: "Not allowed" };
			}

			const deleted = await db
				.delete(journalPost)
				.where(eq(journalPost.id, params.id))
				.returning({ id: journalPost.id });

			if (deleted.length === 0) {
				set.status = 404;
				return { error: "Not found" };
			}

			return { ok: true as const };
		},
		{ params: t.Object({ id: t.String() }) },
	);
