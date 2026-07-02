"use client";

import { api } from "@/lib/api";
import type {
	PatronFeedbackDetail,
	PatronFeedbackListItem,
} from "@/lib/patron-feedback-client";

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
	return Array.isArray(items) ? (items as PatronFeedbackListItem[]) : [];
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
	return res.data as PatronFeedbackDetail;
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
