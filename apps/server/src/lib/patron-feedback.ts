import {
	db,
	type PatronFeedbackCategory,
	type PatronFeedbackStatus,
	patronFeedback,
	patronFeedbackReply,
	patronFeedbackStaffNote,
	profile,
	user,
} from "@still/db";
import { and, desc, eq, type SQL } from "drizzle-orm";

import { makeId } from "./cuid";
import { deliverNotification } from "./notification-delivery";

/** Patron create cap — 10 tickets per rolling 24h window. */
export const PATRON_FEEDBACK_RATE_LIMIT = 10;
export const PATRON_FEEDBACK_RATE_WINDOW_MS = 24 * 60 * 60_000;

const FEEDBACK_BODY_MIN = 10;
const FEEDBACK_BODY_MAX = 2000;
const PAGE_URL_MAX = 500;

const FEEDBACK_CATEGORIES = ["bug", "idea", "other"] as const;
const FEEDBACK_STATUSES = ["open", "resolved", "dismissed"] as const;

export type PatronFeedbackInput = {
	category: PatronFeedbackCategory;
	body: string;
	pageUrl?: string | null;
};

export type PatronFeedbackListItem = {
	id: string;
	category: PatronFeedbackCategory;
	body: string;
	pageUrl: string | null;
	status: PatronFeedbackStatus;
	lastStaffReplyAt: Date | null;
	patronLastReadAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type PatronFeedbackReplyItem = {
	id: string;
	body: string;
	createdAt: Date;
	authorDisplayName: string;
};

export type PatronFeedbackDetail = PatronFeedbackListItem & {
	replies: PatronFeedbackReplyItem[];
};

export type StaffFeedbackSubmitter = {
	userId: string;
	handle: string | null;
	displayName: string | null;
};

export type StaffFeedbackStaffNoteItem = {
	id: string;
	body: string;
	createdAt: Date;
	authorId: string;
	authorDisplayName: string;
};

export type StaffFeedbackListItem = PatronFeedbackListItem & {
	submitter: StaffFeedbackSubmitter;
};

export type StaffFeedbackDetail = StaffFeedbackListItem & {
	replies: PatronFeedbackReplyItem[];
	staffNotes: StaffFeedbackStaffNoteItem[];
};

function isPatronFeedbackCategory(
	value: string,
): value is PatronFeedbackCategory {
	return (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

function isPatronFeedbackStatus(value: string): value is PatronFeedbackStatus {
	return (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

/** Normalize patron or staff message bodies (min 1 for staff, 10 for patron submit). */
export function validateFeedbackMessageBody(
	raw: string,
	opts: { minLength: number; maxLength?: number; label?: string } = {
		minLength: 1,
		maxLength: FEEDBACK_BODY_MAX,
		label: "Message",
	},
): string {
	const body = raw.trim();
	const maxLength = opts.maxLength ?? FEEDBACK_BODY_MAX;
	const label = opts.label ?? "Message";
	if (body.length < opts.minLength) {
		throw new Error(`${label} must be at least ${opts.minLength} characters`);
	}
	if (body.length > maxLength) {
		throw new Error(`${label} must be at most ${maxLength} characters`);
	}
	return body;
}

function validatePageUrl(raw: string | null | undefined): string | null {
	if (raw == null || raw === "") return null;
	const pageUrl = raw.trim();
	if (!pageUrl.startsWith("/")) {
		throw new Error("Page URL must be a relative in-app path");
	}
	if (pageUrl.length > PAGE_URL_MAX) {
		throw new Error(`Page URL must be at most ${PAGE_URL_MAX} characters`);
	}
	return pageUrl;
}

/** Normalize patron submit payload before insert. */
export function parsePatronFeedbackInput(raw: PatronFeedbackInput): {
	category: PatronFeedbackCategory;
	body: string;
	pageUrl: string | null;
} {
	if (!isPatronFeedbackCategory(raw.category)) {
		throw new Error("Invalid feedback category");
	}
	return {
		category: raw.category,
		body: validateFeedbackMessageBody(raw.body, {
			minLength: FEEDBACK_BODY_MIN,
			label: "Feedback",
		}),
		pageUrl: validatePageUrl(raw.pageUrl),
	};
}

/** Inbox deep link opened from notifications or external entry. */
export function buildFeedbackNotificationHref(feedbackId: string): string {
	return `/home?feedback=${encodeURIComponent(feedbackId)}`;
}

/** True when a staff reply exists that the patron has not opened since. */
export function isFeedbackUnread(args: {
	lastStaffReplyAt: Date | null;
	patronLastReadAt: Date | null;
}): boolean {
	if (!args.lastStaffReplyAt) return false;
	if (!args.patronLastReadAt) return true;
	return args.lastStaffReplyAt.getTime() > args.patronLastReadAt.getTime();
}

function mapPatronFeedbackListItem(
	row: typeof patronFeedback.$inferSelect,
): PatronFeedbackListItem {
	return {
		id: row.id,
		category: row.category,
		body: row.body,
		pageUrl: row.pageUrl,
		status: row.status,
		lastStaffReplyAt: row.lastStaffReplyAt,
		patronLastReadAt: row.patronLastReadAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

async function loadReplyItems(
	feedbackId: string,
): Promise<PatronFeedbackReplyItem[]> {
	const rows = await db
		.select({
			id: patronFeedbackReply.id,
			body: patronFeedbackReply.body,
			createdAt: patronFeedbackReply.createdAt,
			authorName: user.name,
			authorDisplayName: profile.displayName,
		})
		.from(patronFeedbackReply)
		.innerJoin(user, eq(patronFeedbackReply.authorId, user.id))
		.leftJoin(profile, eq(patronFeedbackReply.authorId, profile.userId))
		.where(eq(patronFeedbackReply.feedbackId, feedbackId))
		.orderBy(patronFeedbackReply.createdAt);

	return rows.map((row) => ({
		id: row.id,
		body: row.body,
		createdAt: row.createdAt,
		authorDisplayName:
			row.authorDisplayName?.trim() || row.authorName?.trim() || "Sense team",
	}));
}

/** Create a new patron feedback ticket. */
export async function createPatronFeedback(args: {
	userId: string;
	input: PatronFeedbackInput;
}): Promise<{ feedbackId: string }> {
	const parsed = parsePatronFeedbackInput(args.input);
	const feedbackId = makeId("fb");
	const now = new Date();
	await db.insert(patronFeedback).values({
		id: feedbackId,
		userId: args.userId,
		category: parsed.category,
		body: parsed.body,
		pageUrl: parsed.pageUrl,
		status: "open",
		createdAt: now,
		updatedAt: now,
	});
	return { feedbackId };
}

/** List the signed-in patron's tickets, newest first. */
export async function listPatronFeedbackForUser(
	userId: string,
): Promise<PatronFeedbackListItem[]> {
	const rows = await db
		.select()
		.from(patronFeedback)
		.where(eq(patronFeedback.userId, userId))
		.orderBy(desc(patronFeedback.createdAt));
	return rows.map(mapPatronFeedbackListItem);
}

/** Patron thread view — never includes internal staff notes. */
export async function getPatronFeedbackForUser(args: {
	userId: string;
	feedbackId: string;
}): Promise<PatronFeedbackDetail | null> {
	const [row] = await db
		.select()
		.from(patronFeedback)
		.where(eq(patronFeedback.id, args.feedbackId))
		.limit(1);
	if (!row || row.userId !== args.userId) return null;
	const replies = await loadReplyItems(row.id);
	return { ...mapPatronFeedbackListItem(row), replies };
}

/** Mark a patron thread as read after they open it. */
export async function markPatronFeedbackRead(args: {
	userId: string;
	feedbackId: string;
}): Promise<boolean> {
	const now = new Date();
	const updated = await db
		.update(patronFeedback)
		.set({ patronLastReadAt: now, updatedAt: now })
		.where(
			and(
				eq(patronFeedback.id, args.feedbackId),
				eq(patronFeedback.userId, args.userId),
			),
		)
		.returning({ id: patronFeedback.id });
	return updated.length > 0;
}

function buildStaffListWhere(args: {
	status?: PatronFeedbackStatus | "all";
	category?: PatronFeedbackCategory | "all";
}): SQL | undefined {
	const clauses: SQL[] = [];
	if (args.status && args.status !== "all") {
		clauses.push(eq(patronFeedback.status, args.status));
	}
	if (args.category && args.category !== "all") {
		clauses.push(eq(patronFeedback.category, args.category));
	}
	if (clauses.length === 0) return undefined;
	if (clauses.length === 1) return clauses[0];
	return and(...clauses);
}

/** Staff inbox list with optional status/category filters. */
export async function listStaffFeedback(args: {
	status?: PatronFeedbackStatus | "all";
	category?: PatronFeedbackCategory | "all";
	limit?: number;
}): Promise<StaffFeedbackListItem[]> {
	const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
	const whereClause = buildStaffListWhere(args);

	const query = db
		.select({
			feedback: patronFeedback,
			handle: profile.handle,
			displayName: profile.displayName,
		})
		.from(patronFeedback)
		.leftJoin(profile, eq(patronFeedback.userId, profile.userId))
		.orderBy(desc(patronFeedback.createdAt))
		.limit(limit);

	const rows = whereClause ? await query.where(whereClause) : await query;

	return rows.map((row) => ({
		...mapPatronFeedbackListItem(row.feedback),
		submitter: {
			userId: row.feedback.userId,
			handle: row.handle,
			displayName: row.displayName,
		},
	}));
}

/** Staff detail — includes patron-visible replies and internal notes. */
export async function getStaffFeedbackDetail(
	feedbackId: string,
): Promise<StaffFeedbackDetail | null> {
	const [row] = await db
		.select({
			feedback: patronFeedback,
			handle: profile.handle,
			displayName: profile.displayName,
		})
		.from(patronFeedback)
		.leftJoin(profile, eq(patronFeedback.userId, profile.userId))
		.where(eq(patronFeedback.id, feedbackId))
		.limit(1);
	if (!row) return null;

	const replies = await loadReplyItems(feedbackId);

	const noteRows = await db
		.select({
			id: patronFeedbackStaffNote.id,
			body: patronFeedbackStaffNote.body,
			createdAt: patronFeedbackStaffNote.createdAt,
			authorId: patronFeedbackStaffNote.authorId,
			authorName: user.name,
			authorDisplayName: profile.displayName,
		})
		.from(patronFeedbackStaffNote)
		.innerJoin(user, eq(patronFeedbackStaffNote.authorId, user.id))
		.leftJoin(profile, eq(patronFeedbackStaffNote.authorId, profile.userId))
		.where(eq(patronFeedbackStaffNote.feedbackId, feedbackId))
		.orderBy(patronFeedbackStaffNote.createdAt);

	return {
		...mapPatronFeedbackListItem(row.feedback),
		submitter: {
			userId: row.feedback.userId,
			handle: row.handle,
			displayName: row.displayName,
		},
		replies,
		staffNotes: noteRows.map((note) => ({
			id: note.id,
			body: note.body,
			createdAt: note.createdAt,
			authorId: note.authorId,
			authorDisplayName:
				note.authorDisplayName?.trim() || note.authorName?.trim() || "Staff",
		})),
	};
}

/** Staff-visible reply — notifies the submitting patron. */
export async function addStaffFeedbackReply(args: {
	feedbackId: string;
	authorId: string;
	body: string;
}): Promise<{ replyId: string } | { error: "not_found" }> {
	const [ticket] = await db
		.select()
		.from(patronFeedback)
		.where(eq(patronFeedback.id, args.feedbackId))
		.limit(1);
	if (!ticket) return { error: "not_found" };

	const body = validateFeedbackMessageBody(args.body, { minLength: 1 });
	const replyId = makeId("fbr");
	const now = new Date();

	await db.insert(patronFeedbackReply).values({
		id: replyId,
		feedbackId: args.feedbackId,
		authorId: args.authorId,
		body,
		createdAt: now,
	});

	await db
		.update(patronFeedback)
		.set({
			lastStaffReplyAt: now,
			updatedAt: now,
		})
		.where(eq(patronFeedback.id, args.feedbackId));

	const preview = body.length > 120 ? `${body.slice(0, 120)}…` : body;

	await deliverNotification({
		userId: ticket.userId,
		kind: "feedback.replied",
		title: "Sense replied to your feedback",
		body: preview,
		payload: {
			feedbackId: ticket.id,
			href: buildFeedbackNotificationHref(ticket.id),
		},
		context: { actorUserId: args.authorId },
	});

	return { replyId };
}

/** Internal staff note — never returned on patron routes. */
export async function addStaffFeedbackNote(args: {
	feedbackId: string;
	authorId: string;
	body: string;
}): Promise<{ noteId: string } | { error: "not_found" }> {
	const [ticket] = await db
		.select({ id: patronFeedback.id })
		.from(patronFeedback)
		.where(eq(patronFeedback.id, args.feedbackId))
		.limit(1);
	if (!ticket) return { error: "not_found" };

	const body = validateFeedbackMessageBody(args.body, { minLength: 1 });
	const noteId = makeId("fbn");
	const now = new Date();

	await db.insert(patronFeedbackStaffNote).values({
		id: noteId,
		feedbackId: args.feedbackId,
		authorId: args.authorId,
		body,
		createdAt: now,
	});

	await db
		.update(patronFeedback)
		.set({ updatedAt: now })
		.where(eq(patronFeedback.id, args.feedbackId));

	return { noteId };
}

/** Staff triage — no patron notification on status-only changes. */
export async function updatePatronFeedbackStatus(args: {
	feedbackId: string;
	status: PatronFeedbackStatus;
	actorId: string;
}): Promise<{ ok: true } | { error: "not_found" | "invalid_status" }> {
	if (!isPatronFeedbackStatus(args.status)) {
		return { error: "invalid_status" };
	}

	const [ticket] = await db
		.select({ id: patronFeedback.id })
		.from(patronFeedback)
		.where(eq(patronFeedback.id, args.feedbackId))
		.limit(1);
	if (!ticket) return { error: "not_found" };

	const now = new Date();
	const leavingOpen = args.status === "open";

	await db
		.update(patronFeedback)
		.set({
			status: args.status,
			resolvedAt: leavingOpen ? null : now,
			resolvedByUserId: leavingOpen ? null : args.actorId,
			updatedAt: now,
		})
		.where(eq(patronFeedback.id, args.feedbackId));

	return { ok: true };
}
