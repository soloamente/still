/** Journal post lifecycle — stored as text in `journal_post.status`. */
export const JOURNAL_STATUS_DRAFT = "draft" as const;
export const JOURNAL_STATUS_PUBLISHED = "published" as const;

export type JournalStatus =
	| typeof JOURNAL_STATUS_DRAFT
	| typeof JOURNAL_STATUS_PUBLISHED;

export const JOURNAL_DEFAULT_PAGE_LIMIT = 20;
export const JOURNAL_MAX_PAGE_LIMIT = 50;

/** URL-safe slug for public `/journal/[slug]` routes. */
export function normalizeJournalSlug(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 120);
}

export function isValidJournalSlug(slug: string): boolean {
	return slug.length >= 2 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function parseJournalPageLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return JOURNAL_DEFAULT_PAGE_LIMIT;
	return Math.min(Math.floor(n), JOURNAL_MAX_PAGE_LIMIT);
}
