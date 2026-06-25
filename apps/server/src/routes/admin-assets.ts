import { db, list, profile, review, user } from "@still/db";
import { env } from "@still/env/server";
import { constantTimeEqual } from "@still/realtime";
import { and, eq, isNotNull, like } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { getImageAsset, putRawToR2 } from "../lib/asset-store";
import { mediaPublicUrl, putRawToMedia } from "../lib/audio-store";

const VERCEL_HOST = "blob.vercel-storage.com";

function authed(authHeader: string | null): boolean {
	if (!env.REALTIME_INTERNAL_SECRET) return false;
	if (!authHeader?.startsWith("Bearer ")) return false;
	return constantTimeEqual(authHeader.slice(7), env.REALTIME_INTERNAL_SECRET);
}

/** Strip scheme+host from a Vercel Blob URL to recover the R2 object key. */
export function keyFromVercelUrl(url: string): string {
	try {
		return new URL(url).pathname.replace(/^\/+/, "");
	} catch {
		return url;
	}
}

/** Read the existing object via its Vercel URL and write it to R2 under `key`. */
async function copyToR2(sourceUrl: string, key: string): Promise<boolean> {
	const asset = await getImageAsset(sourceUrl);
	if (!asset) {
		console.error("[migrate] could not read source", sourceUrl);
		return false;
	}
	const buf = await new Response(asset.body).arrayBuffer();
	return putRawToR2(key, buf, asset.contentType);
}

export const adminAssetsRoute = new Elysia({
	prefix: "/api/admin/assets",
})
	.post(
		"/migrate-images",
		async ({ request, query, status }) => {
			if (!authed(request.headers.get("Authorization"))) {
				return status(401, "Unauthorized");
			}
			const limit = Math.min(Math.max(Number(query.limit ?? 25), 1), 100);

			const banners = await db
				.select({ userId: profile.userId, url: profile.bannerUrl })
				.from(profile)
				.where(
					and(
						isNotNull(profile.bannerUrl),
						like(profile.bannerUrl, `%${VERCEL_HOST}%`),
					),
				)
				.limit(limit);
			const avatars = await db
				.select({ id: user.id, url: user.image })
				.from(user)
				.where(and(isNotNull(user.image), like(user.image, `%${VERCEL_HOST}%`)))
				.limit(limit);
			const covers = await db
				.select({ id: list.id, url: list.coverImageUrl })
				.from(list)
				.where(
					and(
						isNotNull(list.coverImageUrl),
						like(list.coverImageUrl, `%${VERCEL_HOST}%`),
					),
				)
				.limit(limit);

			let migrated = 0;
			for (const r of banners) {
				if (!r.url) continue;
				const key = keyFromVercelUrl(r.url);
				if (await copyToR2(r.url, key)) {
					await db
						.update(profile)
						.set({ bannerUrl: key })
						.where(eq(profile.userId, r.userId));
					migrated++;
				}
			}
			for (const r of avatars) {
				if (!r.url) continue;
				const key = keyFromVercelUrl(r.url);
				if (await copyToR2(r.url, key)) {
					await db.update(user).set({ image: key }).where(eq(user.id, r.id));
					migrated++;
				}
			}
			for (const r of covers) {
				if (!r.url) continue;
				const key = keyFromVercelUrl(r.url);
				if (await copyToR2(r.url, key)) {
					await db
						.update(list)
						.set({ coverImageUrl: key })
						.where(eq(list.id, r.id));
					migrated++;
				}
			}

			const remaining =
				banners.length + avatars.length + covers.length - migrated;
			return { migrated, remaining };
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	.post(
		"/migrate-audio",
		async ({ request, query, status }) => {
			if (!authed(request.headers.get("Authorization"))) {
				return status(401, "Unauthorized");
			}
			const base = env.MEDIA_PUBLIC_BASE;
			if (!base) return status(503, "MEDIA_PUBLIC_BASE not set");
			const limit = Math.min(Math.max(Number(query.limit ?? 25), 1), 100);

			const rows = await db
				.select({
					id: review.id,
					url: review.audioUrl,
					mime: review.audioMimeType,
				})
				.from(review)
				.where(
					and(
						isNotNull(review.audioUrl),
						like(review.audioUrl, `%${VERCEL_HOST}%`),
					),
				)
				.limit(limit);

			let migrated = 0;
			for (const r of rows) {
				if (!r.url) continue;
				const key = keyFromVercelUrl(r.url);
				const upstream = await fetch(r.url);
				if (!upstream.ok || !upstream.body) {
					console.error("[migrate-audio] fetch failed", r.url);
					continue;
				}
				const bytes = await upstream.arrayBuffer();
				const contentType =
					r.mime ?? upstream.headers.get("content-type") ?? "audio/webm";
				if (await putRawToMedia(key, bytes, contentType)) {
					await db
						.update(review)
						.set({ audioUrl: mediaPublicUrl(base, key) })
						.where(eq(review.id, r.id));
					migrated++;
				}
			}

			return { migrated, remaining: rows.length - migrated };
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	);
