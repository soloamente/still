import "server-only";

import { cookies } from "next/headers";
import { stillApiOrigin } from "@/lib/still-api-origin";
import type { YearInReviewPayload } from "@/lib/year-in-review-types";

async function readYearInReviewJson(
	url: URL,
	cookieHeader?: string,
): Promise<YearInReviewPayload | null> {
	try {
		const response = await fetch(url, {
			cache: "no-store",
			headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
		});
		if (!response.ok) return null;
		return (await response.json()) as YearInReviewPayload;
	} catch {
		return null;
	}
}

async function cookieHeaderFromRequest(): Promise<string | undefined> {
	const store = await cookies();
	const header = store
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
	return header.length > 0 ? header : undefined;
}

/** RSC fetch for the signed-in patron's Wrapped stats. */
export async function fetchMyYearInReviewServer(
	year: number,
): Promise<YearInReviewPayload | null> {
	const url = new URL(`/api/me/year/${year}`, stillApiOrigin());
	return readYearInReviewJson(url, await cookieHeaderFromRequest());
}

/** Public Wrapped stats for OG + share shells (404 when profile is private). */
export async function fetchYearInReviewForHandleServer(
	handle: string,
	year: number,
): Promise<YearInReviewPayload | null> {
	const url = new URL(
		`/api/profiles/${encodeURIComponent(handle.toLowerCase())}/year/${year}`,
		stillApiOrigin(),
	);
	return readYearInReviewJson(url, await cookieHeaderFromRequest());
}
