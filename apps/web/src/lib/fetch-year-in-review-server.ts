import "server-only";

import { cookies } from "next/headers";
import { stillApiOrigin } from "@/lib/still-api-origin";
import type { YearInReviewPayload } from "@/lib/year-in-review-types";

async function readYearInReviewJson(
	url: URL,
	cookieHeader?: string,
): Promise<
	| { kind: "ok"; payload: YearInReviewPayload }
	| { kind: "forbidden" }
	| { kind: "missing" }
> {
	try {
		const response = await fetch(url, {
			cache: "no-store",
			headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
		});
		if (response.status === 403) return { kind: "forbidden" };
		if (!response.ok) return { kind: "missing" };
		return {
			kind: "ok",
			payload: (await response.json()) as YearInReviewPayload,
		};
	} catch {
		return { kind: "missing" };
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
): Promise<
	| { payload: YearInReviewPayload; forbidden?: false }
	| { payload: null; forbidden: true }
	| { payload: null; forbidden?: false }
> {
	const url = new URL(`/api/me/year/${year}`, stillApiOrigin());
	const result = await readYearInReviewJson(
		url,
		await cookieHeaderFromRequest(),
	);
	if (result.kind === "forbidden") {
		return { payload: null, forbidden: true };
	}
	if (result.kind === "missing") {
		return { payload: null };
	}
	return { payload: result.payload };
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
	const result = await readYearInReviewJson(
		url,
		await cookieHeaderFromRequest(),
	);
	return result.kind === "ok" ? result.payload : null;
}
