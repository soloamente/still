/**
 * Vercel's post-build TypeScript pass does not infer Elysia `body` after
 * `.use(context)`. Route hooks still validate at runtime — this only narrows
 * types for the checker and handler code.
 */
export function routeBody<T>(body: unknown): T {
	return body as T;
}
