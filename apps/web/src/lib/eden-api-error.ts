import { notFound } from "next/navigation";

/** Eden treaty errors expose an HTTP status on `error.status`. */
export function edenApiErrorStatus(error: unknown): number | null {
	if (!error || typeof error !== "object" || !("status" in error)) {
		return null;
	}
	const status = (error as { status: unknown }).status;
	return typeof status === "number" ? status : null;
}

export function edenApiErrorMessage(error: unknown, fallback: string): string {
	if (!error || typeof error !== "object" || !("value" in error)) {
		return fallback;
	}
	const value = (error as { value: unknown }).value;
	if (typeof value === "string" && value.trim()) return value;
	return fallback;
}

/**
 * Resolve listing detail API payloads for film/TV pages.
 * Only true catalogue misses become Next `notFound()` — transient upstream
 * failures surface through the route `error.tsx` retry UI instead.
 */
export function requireListingDetailApiData<T>(res: {
	data: T | null;
	error: unknown;
}): T {
	if (res.error) {
		const status = edenApiErrorStatus(res.error);
		if (status === 404) notFound();
		throw new Error(
			edenApiErrorMessage(
				res.error,
				"Couldn't load this title right now. Try again in a moment.",
			),
		);
	}
	if (!res.data) notFound();
	return res.data;
}
