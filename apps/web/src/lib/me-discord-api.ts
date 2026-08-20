import { stillApiOrigin } from "@/lib/still-api-origin";

export type MeDiscordStatusResponse = {
	featureEnabled: boolean;
	/** Attuned+ entitlement when production Discord activity is enabled. */
	canUseDiscordActivity?: boolean;
	connected: boolean;
	guildJoined: boolean;
	discordActivityEnabled: boolean;
	/** Unique Discord username when linked — omit the @ in storage. */
	discordUsername?: string | null;
};

/** Signed-in patron Discord link state for Settings. */
export async function fetchMeDiscordStatus(): Promise<MeDiscordStatusResponse | null> {
	const res = await fetch(`${stillApiOrigin()}/api/me/discord/status`, {
		credentials: "include",
	});
	if (res.status === 401) return null;
	if (!res.ok) return null;
	return (await res.json()) as MeDiscordStatusResponse;
}

/** Retries Sense Presence guild join after OAuth succeeded. */
export async function finishMeDiscordSetup(): Promise<
	{ ok: true; guildJoined: boolean } | { ok: false; message: string }
> {
	const res = await fetch(`${stillApiOrigin()}/api/me/discord/finish-setup`, {
		method: "POST",
		credentials: "include",
	});
	if (res.status === 401) {
		return { ok: false, message: "Sign in to continue" };
	}
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		let message = text.trim();
		try {
			const parsed = JSON.parse(text) as { message?: string };
			if (typeof parsed.message === "string") message = parsed.message;
		} catch {
			// Elysia often returns plain-text error bodies.
		}
		return {
			ok: false,
			message: message || "Couldn't finish Discord setup",
		};
	}
	const data = (await res.json()) as { guildJoined?: boolean };
	return { ok: true, guildJoined: data.guildJoined === true };
}

/** Disconnect Discord — guild kick + prefs + account unlink on the server. */
export async function disconnectMeDiscord(): Promise<
	{ ok: true } | { ok: false; message: string }
> {
	const res = await fetch(`${stillApiOrigin()}/api/me/discord`, {
		method: "DELETE",
		credentials: "include",
	});
	if (res.status === 401) {
		return { ok: false, message: "Sign in to continue" };
	}
	if (!res.ok) {
		return { ok: false, message: "Couldn't disconnect Discord" };
	}
	return { ok: true };
}
