/** Patron mention tokens store profile deep links — only these trigger inbox rows. */
const PATRON_TOKEN = /@\[[^\]]+\]\(\/profile\/([^)]+)\)/g;

/** Unique lowercase handles from `/profile/:handle` tokens in review or comment bodies. */
export function extractPatronMentionHandles(body: string): string[] {
	const handles = new Set<string>();
	for (const match of body.matchAll(PATRON_TOKEN)) {
		const handle = match[1]?.trim().toLowerCase();
		if (handle) handles.add(handle);
	}
	return Array.from(handles);
}
