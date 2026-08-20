import { stillApiOrigin } from "@/lib/still-api-origin";

export type ProfileDiscordActivity = {
	kind: "listening" | "playing" | "streaming" | "watching";
	label: string;
	detail?: string;
	imageUrl?: string | null;
	albumName?: string;
	creatorName?: string;
	creatorImageUrl?: string | null;
	headline?: string;
	source?: string;
	progress?: {
		startedAtMs: number;
		endsAtMs: number;
	};
	/** Sampled from cover art — drives progress + ambient tint on profile hero. */
	accentColor?: string | null;
};

export type ProfileDiscordActivityPayload =
	| { visible: false }
	| { visible: true; activity: ProfileDiscordActivity };

/** Browser fetch for profile Discord activity (account menu + client refresh). */
export async function fetchProfileDiscordActivityClient(
	handle: string,
): Promise<ProfileDiscordActivityPayload> {
	const res = await fetch(
		`${stillApiOrigin()}/api/profiles/${encodeURIComponent(handle)}/discord-activity`,
		{ credentials: "include" },
	);
	if (!res.ok) return { visible: false };
	return (await res.json()) as ProfileDiscordActivityPayload;
}
