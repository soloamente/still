/** Patron feedback categories (matches server enum). */
export type PatronFeedbackCategory = "bug" | "idea" | "other";

/** Staff triage status (matches server enum). */
export type PatronFeedbackStatus = "open" | "resolved" | "dismissed";

export type PatronFeedbackListItem = {
	id: string;
	category: PatronFeedbackCategory;
	body: string;
	pageUrl: string | null;
	status: PatronFeedbackStatus;
	lastStaffReplyAt: string | null;
	patronLastReadAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export type PatronFeedbackReplyItem = {
	id: string;
	body: string;
	createdAt: string;
	authorDisplayName: string;
};

export type PatronFeedbackDetail = PatronFeedbackListItem & {
	replies: PatronFeedbackReplyItem[];
};

export const PATRON_FEEDBACK_CATEGORY_OPTIONS = [
	{ id: "bug" as const, label: "Bug" },
	{ id: "idea" as const, label: "Idea" },
	{ id: "other" as const, label: "Other" },
];

export const PATRON_FEEDBACK_CATEGORY_LABEL: Record<
	PatronFeedbackCategory,
	string
> = {
	bug: "Bug",
	idea: "Idea",
	other: "Other",
};

export const PATRON_FEEDBACK_STATUS_LABEL: Record<
	PatronFeedbackStatus,
	string
> = {
	open: "Open",
	resolved: "Resolved",
	dismissed: "Dismissed",
};

/** Unread when staff replied after the patron last opened the thread. */
export function isPatronFeedbackUnread(item: {
	lastStaffReplyAt: string | null;
	patronLastReadAt: string | null;
}): boolean {
	if (!item.lastStaffReplyAt) return false;
	const replyAt = new Date(item.lastStaffReplyAt).getTime();
	if (!item.patronLastReadAt) return true;
	return replyAt > new Date(item.patronLastReadAt).getTime();
}

export function patronFeedbackPlaceholder(
	category: PatronFeedbackCategory,
): string {
	switch (category) {
		case "bug":
			return "What broke? Include steps to reproduce if you can.";
		case "idea":
			return "What would you like to see in Sense?";
		default:
			return "Tell us what's on your mind.";
	}
}
