/**
 * Best-effort extraction of a human-readable message from an Eden Treaty
 * error value shape (`res.error.value` is often a plain string). Falls back
 * to `fallback` when nothing usable is found.
 *
 * Shared across staff-panel components that surface API errors via `sonner`
 * toasts — previously duplicated verbatim in `staff-users-tab.tsx` and
 * `staff-content-actions.tsx`.
 */
export function errorMessage(value: unknown, fallback: string): string {
	if (typeof value === "string" && value.trim()) return value;
	if (
		value &&
		typeof value === "object" &&
		"value" in value &&
		typeof (value as { value: unknown }).value === "string"
	) {
		return (value as { value: string }).value;
	}
	return fallback;
}
