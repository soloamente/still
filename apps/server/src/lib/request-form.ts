/**
 * Read a multipart form field from Elysia's already-parsed `ctx.body`.
 *
 * On Cloudflare Workers a request body is a single-use stream, and Elysia
 * consumes it to populate `ctx.body`. Calling `request.formData()` again in a
 * handler then throws "Body has already been used". So upload handlers must read
 * fields from `body` instead of re-reading the request. (Bun tolerated the
 * double read; workerd does not.)
 */
export function formField(body: unknown, key: string): unknown {
	if (body && typeof body === "object") {
		return (body as Record<string, unknown>)[key];
	}
	return undefined;
}
