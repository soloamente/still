/** Nested key on `profile.preferences` — must match server `PROFILE_PREF_NOTIFICATIONS`. */
export const PROFILE_PREF_NOTIFICATIONS = "notifications" as const;

export type NotificationKind =
	| "follow.created"
	| "comment.on_review"
	| "comment.replied"
	| "badge.awarded"
	| "import.completed"
	| "taste.challenge"
	| "challenge.completed"
	| "review.liked"
	| "chat.message"
	| "tv.new_episode";

/** Mirrors server registry for Settings labels (keep ids in sync with `notification-delivery.ts`). */
export const NOTIFICATION_KIND_SETTINGS: ReadonlyArray<{
	id: NotificationKind;
	label: string;
	description: string;
	defaultEnabled: boolean;
}> = [
	{
		id: "follow.created",
		label: "New followers",
		description: "When someone starts following you.",
		defaultEnabled: true,
	},
	{
		id: "comment.on_review",
		label: "Comments on your reviews",
		description: "When someone comments on a review you wrote.",
		defaultEnabled: true,
	},
	{
		id: "comment.replied",
		label: "Replies to your comments",
		description: "When someone replies in a thread you joined.",
		defaultEnabled: true,
	},
	{
		id: "badge.awarded",
		label: "Badge unlocks",
		description: "Prestige badges and milestones worth celebrating.",
		defaultEnabled: true,
	},
	{
		id: "import.completed",
		label: "Diary imports",
		description: "When a Letterboxd import finishes.",
		defaultEnabled: true,
	},
	{
		id: "taste.challenge",
		label: "Taste challenges",
		description: "When someone invites you to compare taste.",
		defaultEnabled: true,
	},
	{
		id: "challenge.completed",
		label: "Completionist challenges",
		description: "When you finish a challenge set you joined.",
		defaultEnabled: true,
	},
	{
		id: "review.liked",
		label: "Review likes",
		description: "Only when you and the liker follow each other.",
		defaultEnabled: false,
	},
	{
		id: "chat.message",
		label: "Chat messages",
		description: "New messages in threads you belong to.",
		defaultEnabled: true,
	},
	{
		id: "tv.new_episode",
		label: "New TV episodes",
		description: "When a show you track airs a new episode.",
		defaultEnabled: true,
	},
];

const DEFAULTS = Object.fromEntries(
	NOTIFICATION_KIND_SETTINGS.map((k) => [k.id, k.defaultEnabled]),
) as Record<NotificationKind, boolean>;

/** Read merged notification toggles from profile `preferences`. */
export function readNotificationPrefsFromProfile(
	preferences: Record<string, unknown> | null | undefined,
): Record<NotificationKind, boolean> {
	const merged = { ...DEFAULTS };
	const raw = preferences?.[PROFILE_PREF_NOTIFICATIONS];
	if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
		return merged;
	}
	for (const entry of NOTIFICATION_KIND_SETTINGS) {
		const value = (raw as Record<string, unknown>)[entry.id];
		if (typeof value === "boolean") merged[entry.id] = value;
	}
	return merged;
}

/** Build the nested blob for PATCH `preferences.notifications`. */
export function buildNotificationPrefsPatch(
	prefs: Record<NotificationKind, boolean>,
): Record<string, boolean> {
	return { ...prefs };
}
