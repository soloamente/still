import type { ContentMentionPart } from "@/lib/content-mentions";
import { mentionHoverPreviewCacheKey } from "@/lib/mention-hover-preview-cache-key";
import { profilePatronAvatarImageUrl } from "@/lib/profile-avatar";
import { isStillApiErrorPayload } from "@/lib/still-api-error-payload";
import { stillApiOrigin } from "@/lib/still-api-origin";

/** Visual shape for the cursor-following mention preview chip. */
export type MentionHoverPreviewShape = "poster" | "portrait";

export type MentionHoverPreviewPayload = {
	label: string;
	imageUrl: string | null;
	shape: MentionHoverPreviewShape;
};

type MentionEntityPart = Exclude<ContentMentionPart, { type: "text" }>;

const previewCache = new Map<string, MentionHoverPreviewPayload>();

function listingIdFromHref(
	href: `/movies/${number}` | `/tv/${number}`,
): number {
	const segment = href.split("/").pop();
	return Number(segment);
}

async function fetchListingPreview(
	part: Extract<MentionEntityPart, { type: "listing" }>,
): Promise<MentionHoverPreviewPayload> {
	const id = listingIdFromHref(part.href);
	const segment = part.listingKind === "movie" ? "movies" : "tv";
	const res = await fetch(`${stillApiOrigin()}/api/${segment}/${id}`, {
		credentials: "include",
	});
	const data: unknown = await res.json();
	if (!res.ok || isStillApiErrorPayload(data)) {
		return { label: part.label, imageUrl: null, shape: "poster" };
	}
	const posterUrl =
		typeof (data as { poster_url?: unknown }).poster_url === "string"
			? (data as { poster_url: string }).poster_url
			: null;
	return { label: part.label, imageUrl: posterUrl, shape: "poster" };
}

async function fetchPersonPreview(
	part: Extract<MentionEntityPart, { type: "person" }>,
): Promise<MentionHoverPreviewPayload> {
	const res = await fetch(
		`${stillApiOrigin()}/api/people/${part.tmdbPersonId}`,
		{ credentials: "include" },
	);
	const data: unknown = await res.json();
	if (!res.ok || isStillApiErrorPayload(data)) {
		return { label: part.label, imageUrl: null, shape: "portrait" };
	}
	const profileUrl =
		typeof (data as { person?: { profileUrl?: unknown } }).person
			?.profileUrl === "string"
			? (data as { person: { profileUrl: string } }).person.profileUrl
			: null;
	return { label: part.label, imageUrl: profileUrl, shape: "portrait" };
}

function patronPreview(
	part: Extract<MentionEntityPart, { type: "patron" }>,
): MentionHoverPreviewPayload {
	return {
		label: part.label,
		imageUrl: profilePatronAvatarImageUrl(part.handle),
		shape: "portrait",
	};
}

/** Resolve poster/headshot for a parsed mention token — cached in-memory per session. */
export async function fetchMentionHoverPreview(
	part: MentionEntityPart,
): Promise<MentionHoverPreviewPayload> {
	const cacheKey = mentionHoverPreviewCacheKey(part);
	const cached = previewCache.get(cacheKey);
	if (cached) return cached;

	let payload: MentionHoverPreviewPayload;
	switch (part.type) {
		case "listing":
			payload = await fetchListingPreview(part);
			break;
		case "person":
			payload = await fetchPersonPreview(part);
			break;
		case "patron":
			payload = patronPreview(part);
			break;
		default: {
			const _exhaustive: never = part;
			payload = {
				label: String(_exhaustive),
				imageUrl: null,
				shape: "portrait",
			};
		}
	}

	previewCache.set(cacheKey, payload);
	return payload;
}
