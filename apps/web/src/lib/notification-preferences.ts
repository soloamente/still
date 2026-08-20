/** Nested key on `profile.preferences` — must match server `PROFILE_PREF_NOTIFICATIONS`. */
export const PROFILE_PREF_NOTIFICATIONS = "notifications" as const;

export type NotificationSettingsGroup = "social" | "watching" | "milestones";

export type NotificationKind =
	| "follow.created"
	| "comment.on_review"
	| "comment.replied"
	| "mention.in_review_or_comment"
	| "badge.awarded"
	| "import.completed"
	| "taste.challenge"
	| "challenge.completed"
	| "review.liked"
	| "chat.message"
	| "tv.new_episode"
	| "watchlist_now_streaming";

/** Mirrors server registry for Settings labels (keep ids in sync with `notification-delivery.ts`). */
export const NOTIFICATION_KIND_SETTINGS: ReadonlyArray<{
	id: NotificationKind;
	group: NotificationSettingsGroup;
	label: string;
	description: string;
	defaultEnabled: boolean;
}> = [
	{
		id: "follow.created",
		group: "social",
		label: "New followers",
		description: "When someone starts following you.",
		defaultEnabled: true,
	},
	{
		id: "comment.on_review",
		group: "social",
		label: "Comments on your reviews",
		description: "When someone comments on a review you wrote.",
		defaultEnabled: true,
	},
	{
		id: "comment.replied",
		group: "social",
		label: "Replies to your comments",
		description: "When someone replies in a thread you joined.",
		defaultEnabled: true,
	},
	{
		id: "mention.in_review_or_comment",
		group: "social",
		label: "Mentions",
		description: "When someone @mentions you in a review or comment.",
		defaultEnabled: true,
	},
	{
		id: "review.liked",
		group: "social",
		label: "Review likes",
		description: "Only when you and the liker follow each other.",
		defaultEnabled: false,
	},
	{
		id: "chat.message",
		group: "social",
		label: "Chat messages",
		description: "New messages in threads you belong to.",
		defaultEnabled: true,
	},
	{
		id: "tv.new_episode",
		group: "watching",
		label: "New TV episodes",
		description: "When a show you track airs a new episode.",
		defaultEnabled: true,
	},
	{
		id: "watchlist_now_streaming",
		group: "watching",
		label: "Watchlist streaming",
		description: "When a watchlisted title starts streaming in your region.",
		defaultEnabled: true,
	},
	{
		id: "import.completed",
		group: "watching",
		label: "Diary imports",
		description: "When a Letterboxd import finishes.",
		defaultEnabled: true,
	},
	{
		id: "badge.awarded",
		group: "milestones",
		label: "Badge unlocks",
		description: "Prestige badges and milestones worth celebrating.",
		defaultEnabled: true,
	},
	{
		id: "taste.challenge",
		group: "milestones",
		label: "Taste challenges",
		description: "When someone invites you to compare taste.",
		defaultEnabled: true,
	},
	{
		id: "challenge.completed",
		group: "milestones",
		label: "Completionist challenges",
		description: "When you finish a challenge set you joined.",
		defaultEnabled: true,
	},
];

const NOTIFICATION_SETTINGS_SECTIONS: ReadonlyArray<{
	group: NotificationSettingsGroup;
	title: string;
	description: string;
}> = [
	{
		group: "social",
		title: "Social",
		description: "Follows, mentions, and conversation.",
	},
	{
		group: "watching",
		title: "Watching",
		description: "New episodes, streaming, and imports.",
	},
	{
		group: "milestones",
		title: "Milestones",
		description: "Badges and challenges.",
	},
];

/** Settings → Notifications section order and copy. */
export function notificationSettingsSections() {
	return NOTIFICATION_SETTINGS_SECTIONS.map((section) => ({
		...section,
		entries: NOTIFICATION_KIND_SETTINGS.filter(
			(entry) => entry.group === section.group,
		),
	}));
}

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
