import { stillApiOrigin } from "@/lib/still-api-origin";

export type DevotedRequestResult =
	| { ok: true }
	| { ok: false; status: number; message: string };

/** Request a Devoted invite — notifies owner/admin staff + records funnel event. */
export async function submitDevotedRequestClient(): Promise<DevotedRequestResult> {
	const response = await fetch(
		`${stillApiOrigin()}/api/plans/devoted-request`,
		{
			method: "POST",
			credentials: "include",
		},
	);

	if (response.ok) {
		return { ok: true };
	}

	const fallback =
		response.status === 401
			? "Sign in to request a Devoted invite"
			: response.status === 429
				? "Slow down — try again in a bit"
				: "Could not send your request";

	const raw = await response.text().catch(() => "");
	let message = fallback;
	if (raw.trim()) {
		try {
			const body = JSON.parse(raw) as { error?: string };
			if (typeof body.error === "string" && body.error.trim()) {
				message = body.error;
			} else {
				message = raw.trim();
			}
		} catch {
			message = raw.trim();
		}
	}

	return { ok: false, status: response.status, message };
}
