/**
 * Map Elysia error codes to HTTP status for consistent client handling.
 * Without this, NOT_FOUND responses default to 200 and browsers treat them as success.
 */
export function mapElysiaErrorStatus(code: string | number): number {
	switch (code) {
		case "NOT_FOUND":
			return 404;
		case "VALIDATION":
			return 422;
		case "PARSE":
			return 400;
		case "INVALID_COOKIE_SIGNATURE":
			return 401;
		case "INTERNAL_SERVER_ERROR":
			return 500;
		default:
			return 500;
	}
}
