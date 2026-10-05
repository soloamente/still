/**
 * Public site. Discord activity buttons must be https, so a localhost
 * auth URL cannot be the link other people open.
 */
export const SENSE_PUBLIC_PROFILE_ORIGIN = "https://cinema.sense.fans";

/** Prefer the configured https origin. Local http falls back to the public site. */
export function companionButtonOrigin(configured: string): string {
	try {
		const url = new URL(configured);
		if (url.protocol === "https:") return url.origin;
	} catch {
		// A missing or relative auth URL still needs a public profile link.
	}
	return SENSE_PUBLIC_PROFILE_ORIGIN;
}

export function companionProfileButtonUrl(input: {
	origin: string;
	handle: string | null;
	isPrivate: boolean;
}): string | null {
	const handle = input.handle?.trim() ?? "";
	if (!handle || input.isPrivate) return null;
	let url: URL;
	try {
		url = new URL(`/profile/${encodeURIComponent(handle)}`, input.origin);
	} catch {
		return null;
	}
	if (url.protocol !== "https:") return null;
	return url.toString();
}

/** https link to the matched film or show. Discord drops http buttons. */
export function companionTitleButtonUrl(
	origin: string,
	href: string | null | undefined,
): string | null {
	if (!href?.startsWith("/")) return null;
	let url: URL;
	try {
		url = new URL(href, origin);
	} catch {
		return null;
	}
	if (url.protocol !== "https:") return null;
	return url.toString();
}
