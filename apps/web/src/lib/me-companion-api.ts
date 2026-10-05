import { stillApiOrigin } from "@/lib/still-api-origin";

export type MeCompanionStatus = {
	paired: boolean;
	devices: { id: string; createdAt: string }[];
};

export type MeCompanionCode = {
	code: string;
	expiresAt: string;
};

/** Signed-in companion devices for Settings → Profile. */
export async function fetchMeCompanionStatus(): Promise<MeCompanionStatus | null> {
	const res = await fetch(`${stillApiOrigin()}/api/me/companion`, {
		credentials: "include",
	});
	if (!res.ok) return null;
	return (await res.json()) as MeCompanionStatus;
}

/** Issues a 10-minute code the extension popup exchanges for a device token. */
export async function issueMeCompanionCode(): Promise<
	{ ok: true; code: MeCompanionCode } | { ok: false; message: string }
> {
	const res = await fetch(`${stillApiOrigin()}/api/me/companion/pair`, {
		method: "POST",
		credentials: "include",
	});
	if (res.status === 401) return { ok: false, message: "Sign in to continue" };
	if (!res.ok) return { ok: false, message: "Couldn't create a pairing code" };
	const code = (await res.json()) as MeCompanionCode;
	return { ok: true, code };
}

/** Revokes every companion device token for this patron. */
export async function revokeMeCompanion(): Promise<
	{ ok: true; revoked: number } | { ok: false; message: string }
> {
	const res = await fetch(`${stillApiOrigin()}/api/me/companion`, {
		method: "DELETE",
		credentials: "include",
	});
	if (res.status === 401) return { ok: false, message: "Sign in to continue" };
	if (!res.ok) return { ok: false, message: "Couldn't disconnect the browser" };
	const body = (await res.json()) as { revoked?: number };
	return { ok: true, revoked: body.revoked ?? 0 };
}

/**
 * Immediate PATCH for "Share what I'm watching".
 * Sends only the integrations key; the server deep-merges it onto the profile.
 */
export async function setCompanionWatchingShared(
	enabled: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const res = await fetch(`${stillApiOrigin()}/api/profiles/me`, {
		method: "PATCH",
		credentials: "include",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			preferences: {
				integrations: { companionWatchingEnabled: enabled },
			},
		}),
	});
	if (res.status === 401) return { ok: false, message: "Sign in to continue" };
	if (!res.ok) return { ok: false, message: "Couldn't update sharing" };
	return { ok: true };
}
