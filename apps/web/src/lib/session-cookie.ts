/**
 * Better Auth session cookie names (with and without the `__Secure-` prefix
 * used in production). Shared by the proxy (presence gate) and the
 * `/signed-out` route handler (which clears them).
 */
export const SESSION_COOKIE_NAMES = [
	"better-auth.session_token",
	"__Secure-better-auth.session_token",
] as const;
