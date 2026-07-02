"use client";

import { api } from "@/lib/api";
import type {
	PatronFeedbackDetail,
	PatronFeedbackListItem,
} from "@/lib/patron-feedback-client";

function asIsoString(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	throw new Error("Could not load feedback timestamps");
}

function asNullableIsoString(value: unknown): string | null {
	if (value == null) return null;
	return asIsoString(value);
}

function normalizeFeedbackListItem(
	value: unknown,
): PatronFeedbackListItem | null {
	if (!value || typeof value !== "object") return null;
	const item = value as Record<string, unknown>;
	if (
		typeof item.id !== "string" ||
		(item.category !== "bug" &&
			item.category !== "idea" &&
			item.category !== "other") ||
		typeof item.body !== "string" ||
		(item.pageUrl !== null && typeof item.pageUrl !== "string") ||
		(item.status !== "open" &&
			item.status !== "resolved" &&
			item.status !== "dismissed")
	) {
		return null;
	}
	return {
		id: item.id,
		category: item.category,
		body: item.body,
		pageUrl: item.pageUrl,
		status: item.status,
		lastStaffReplyAt: asNullableIsoString(item.lastStaffReplyAt),
		patronLastReadAt: asNullableIsoString(item.patronLastReadAt),
		createdAt: asIsoString(item.createdAt),
		updatedAt: asIsoString(item.updatedAt),
	};
}

function normalizeFeedbackDetail(value: unknown): PatronFeedbackDetail {
	const base = normalizeFeedbackListItem(value);
	if (!base || typeof value !== "object") {
		throw new Error("Could not load this feedback");
	}
	const item = value as Record<string, unknown>;
	const repliesRaw = item.replies;
	if (!Array.isArray(repliesRaw)) {
		throw new Error("Could not load this feedback");
	}
	const replies = repliesRaw
		.map((reply): PatronFeedbackDetail["replies"][number] | null => {
			if (!reply || typeof reply !== "object") return null;
			const row = reply as Record<string, unknown>;
			if (
				typeof row.id !== "string" ||
				typeof row.body !== "string" ||
				typeof row.authorDisplayName !== "string"
			) {
				return null;
			}
			return {
				id: row.id,
				body: row.body,
				createdAt: asIsoString(row.createdAt),
				authorDisplayName: row.authorDisplayName,
			};
		})
		.filter((reply) => reply !== null);
	return { ...base, replies };
}

function readApiError(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim().length > 0
		? value
		: fallback;
}

/** List the signed-in patron's feedback tickets. */
export async function fetchPatronFeedbackList(): Promise<
	PatronFeedbackListItem[]
> {
	const res = await api.api.feedback.get();
	if (res.error) {
		throw new Error(
			readApiError(res.error.value, "Could not load your feedback"),
		);
	}
	const items = res.data?.items;
	if (!Array.isArray(items)) return [];
	return items
		.map((item) => normalizeFeedbackListItem(item))
		.filter((item) => item !== null);
}

/** Load one feedback thread for the signed-in patron. */
export async function fetchPatronFeedbackDetail(
	feedbackId: string,
): Promise<PatronFeedbackDetail> {
	const res = await api.api.feedback({ id: feedbackId }).get();
	if (res.error) {
		throw new Error(
			readApiError(res.error.value, "Could not load this feedback"),
		);
	}
	if (!res.data || typeof res.data !== "object") {
		throw new Error("Could not load this feedback");
	}
	return normalizeFeedbackDetail(res.data);
}

/** Mark a thread as read after the patron opens it. */
export async function markPatronFeedbackRead(
	feedbackId: string,
): Promise<void> {
	const res = await api.api.feedback({ id: feedbackId }).read.patch({});
	if (res.error) {
		throw new Error(
			readApiError(res.error.value, "Could not update read state"),
		);
	}
}

/** Submit new patron feedback. */
export async function submitPatronFeedback(input: {
	category: "bug" | "idea" | "other";
	body: string;
	pageUrl: string | null;
}): Promise<{ feedbackId: string }> {
	const res = await api.api.feedback.post({
		category: input.category,
		body: input.body,
		pageUrl: input.pageUrl,
	});
	if (res.error) {
		throw new Error(readApiError(res.error.value, "Could not send feedback"));
	}
	const feedbackId = res.data?.feedbackId;
	if (typeof feedbackId !== "string" || feedbackId.length === 0) {
		throw new Error("Could not send feedback");
	}
	return { feedbackId };
}
