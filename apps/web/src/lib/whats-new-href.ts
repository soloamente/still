/** Replace `:handle` tokens in manifest CTAs with the signed-in patron handle. */
export function resolveWhatsNewHref(href: string, handle: string): string {
	return href.replace(":handle", encodeURIComponent(handle.trim()));
}
