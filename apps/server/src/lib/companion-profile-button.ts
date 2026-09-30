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
