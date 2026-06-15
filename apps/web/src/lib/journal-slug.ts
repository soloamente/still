/** URL-safe slug for public `/journal/[slug]` routes — mirrors server `journal-post.ts`. */
export function normalizeJournalSlug(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 120);
}
