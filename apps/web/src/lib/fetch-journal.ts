import "server-only";

import { env } from "@still/env/web";

export type JournalListItem = {
	id: string;
	slug: string;
	title: string;
	dek: string | null;
	heroImageUrl: string | null;
	publishedAt: string | null;
	tags: string[];
};

export type JournalAuthor = {
	name: string | null;
	handle: string | null;
	image: string | null;
};

export type JournalPostDetail = JournalListItem & {
	body: string;
	authorUserId: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	author: JournalAuthor | null;
};

export type JournalListResponse = {
	items: JournalListItem[];
	page: number;
	limit: number;
	nextPage: number | null;
};

export type JournalSitemapEntry = {
	slug: string;
	updatedAt: string;
};

function journalApiUrl(path: string, params?: Record<string, string>) {
	const url = new URL(path, env.NEXT_PUBLIC_SERVER_URL);
	if (params) {
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
	}
	return url;
}

/** Published journal index for `/journal` and sitemap helpers. */
export async function fetchJournalPosts(options?: {
	page?: number;
	limit?: number;
	revalidate?: number;
}): Promise<JournalListResponse | null> {
	const url = journalApiUrl("/api/journal", {
		...(options?.page != null ? { page: String(options.page) } : {}),
		...(options?.limit != null ? { limit: String(options.limit) } : {}),
	});

	try {
		const res = await fetch(url, {
			next: { revalidate: options?.revalidate ?? 300 },
		});
		if (!res.ok) return null;
		return (await res.json()) as JournalListResponse;
	} catch {
		return null;
	}
}

/** Single published article by slug — 404 when missing or draft. */
export async function fetchJournalPostBySlug(
	slug: string,
): Promise<JournalPostDetail | null> {
	const url = journalApiUrl(`/api/journal/${encodeURIComponent(slug)}`);

	try {
		const res = await fetch(url, { next: { revalidate: 300 } });
		if (res.status === 404) return null;
		if (!res.ok) return null;
		return (await res.json()) as JournalPostDetail;
	} catch {
		return null;
	}
}

/** Slugs + timestamps for SEO sitemap generation. */
export async function fetchJournalSitemapEntries(): Promise<
	JournalSitemapEntry[]
> {
	const url = journalApiUrl("/api/journal/sitemap", { limit: "500" });

	try {
		const res = await fetch(url, { next: { revalidate: 3600 } });
		if (!res.ok) return [];
		const payload = (await res.json()) as { entries?: JournalSitemapEntry[] };
		return payload.entries ?? [];
	} catch {
		return [];
	}
}
