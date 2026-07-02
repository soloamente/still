"use client";

import { Button } from "@still/ui/components/button";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { api } from "@/lib/api";
import { formatDistanceToNowStrict } from "@/lib/format";
import {
	PATRON_FEEDBACK_CATEGORY_LABEL,
	PATRON_FEEDBACK_STATUS_LABEL,
	type PatronFeedbackCategory,
	type PatronFeedbackStatus,
} from "@/lib/patron-feedback-client";
import { errorMessage } from "@/lib/staff-error-message";

type FeedbackStatusFilter = PatronFeedbackStatus | "all";
type FeedbackCategoryFilter = PatronFeedbackCategory | "all";

type StaffFeedbackSubmitter = {
	userId: string;
	handle: string | null;
	displayName: string | null;
};

type StaffFeedbackListItem = {
	id: string;
	category: PatronFeedbackCategory;
	body: string;
	pageUrl: string | null;
	status: PatronFeedbackStatus;
	lastStaffReplyAt: string | null;
	patronLastReadAt: string | null;
	createdAt: string;
	updatedAt: string;
	submitter: StaffFeedbackSubmitter;
};

type StaffFeedbackReplyItem = {
	id: string;
	body: string;
	createdAt: string;
	authorDisplayName: string;
};

type StaffFeedbackNoteItem = {
	id: string;
	body: string;
	createdAt: string;
	authorId: string;
	authorDisplayName: string;
};

type StaffFeedbackDetail = StaffFeedbackListItem & {
	replies: StaffFeedbackReplyItem[];
	staffNotes: StaffFeedbackNoteItem[];
};

const STATUS_FILTER_OPTIONS = [
	{ id: "open" as const, label: "Open" },
	{ id: "resolved" as const, label: "Resolved" },
	{ id: "dismissed" as const, label: "Dismissed" },
	{ id: "all" as const, label: "All" },
];

const CATEGORY_FILTER_OPTIONS = [
	{ id: "all" as const, label: "All" },
	{ id: "bug" as const, label: "Bug" },
	{ id: "idea" as const, label: "Idea" },
	{ id: "other" as const, label: "Other" },
];

function normalizeTimestamp(value: unknown): string {
	if (typeof value === "string") return value;
	if (value instanceof Date) return value.toISOString();
	return new Date(String(value)).toISOString();
}

function formatSubmitter(submitter: StaffFeedbackSubmitter): string {
	if (submitter.displayName?.trim()) {
		return submitter.handle
			? `${submitter.displayName} (@${submitter.handle})`
			: submitter.displayName;
	}
	return submitter.handle ? `@${submitter.handle}` : "Patron";
}

function formatWhen(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return `${formatDistanceToNowStrict(date)} ago`;
}

/**
 * Staff patron-feedback triage — list, thread detail, patron-visible replies,
 * and internal notes (owner/admin can reply and change status).
 */
export function StaffFeedbackPanel({ currentRole }: { currentRole: string }) {
	const canReply = currentRole === "owner" || currentRole === "admin";
	const fieldIdBase = useId();

	const [statusFilter, setStatusFilter] =
		useState<FeedbackStatusFilter>("open");
	const [categoryFilter, setCategoryFilter] =
		useState<FeedbackCategoryFilter>("all");
	const [items, setItems] = useState<StaffFeedbackListItem[]>([]);
	const [loadingList, setLoadingList] = useState(true);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [detail, setDetail] = useState<StaffFeedbackDetail | null>(null);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [busy, setBusy] = useState(false);
	const [replyBody, setReplyBody] = useState("");
	const [noteBody, setNoteBody] = useState("");

	const listWaveKey = `${statusFilter}:${categoryFilter}`;

	const loadList = useCallback(async () => {
		setLoadingList(true);
		try {
			const res = await api.api.staff.feedback.get({
				query: {
					status: statusFilter,
					category: categoryFilter,
				},
			});
			if (res.error) {
				toast.error(
					errorMessage(res.error.value, "Could not load feedback inbox"),
				);
				return;
			}
			const data = res.data as unknown as { items?: StaffFeedbackListItem[] };
			const rows = (data?.items ?? []).map((row) => ({
				...row,
				createdAt: normalizeTimestamp(row.createdAt),
				updatedAt: normalizeTimestamp(row.updatedAt),
				lastStaffReplyAt: row.lastStaffReplyAt
					? normalizeTimestamp(row.lastStaffReplyAt)
					: null,
				patronLastReadAt: row.patronLastReadAt
					? normalizeTimestamp(row.patronLastReadAt)
					: null,
			}));
			setItems(rows);
			setSelectedId((prev) => {
				if (prev && rows.some((row) => row.id === prev)) return prev;
				return rows[0]?.id ?? null;
			});
		} catch {
			toast.error("Could not load feedback inbox");
		} finally {
			setLoadingList(false);
		}
	}, [statusFilter, categoryFilter]);

	const loadDetail = useCallback(async (feedbackId: string) => {
		setLoadingDetail(true);
		try {
			const res = await api.api.staff.feedback({ id: feedbackId }).get();
			if (res.error) {
				toast.error(
					errorMessage(res.error.value, "Could not load feedback thread"),
				);
				setDetail(null);
				return;
			}
			const row = res.data as unknown as StaffFeedbackDetail;
			setDetail({
				...row,
				createdAt: normalizeTimestamp(row.createdAt),
				updatedAt: normalizeTimestamp(row.updatedAt),
				lastStaffReplyAt: row.lastStaffReplyAt
					? normalizeTimestamp(row.lastStaffReplyAt)
					: null,
				patronLastReadAt: row.patronLastReadAt
					? normalizeTimestamp(row.patronLastReadAt)
					: null,
				replies: (row.replies ?? []).map((reply) => ({
					...reply,
					createdAt: normalizeTimestamp(reply.createdAt),
				})),
				staffNotes: (row.staffNotes ?? []).map((note) => ({
					...note,
					createdAt: normalizeTimestamp(note.createdAt),
				})),
			});
		} catch {
			toast.error("Could not load feedback thread");
			setDetail(null);
		} finally {
			setLoadingDetail(false);
		}
	}, []);

	useEffect(() => {
		void loadList();
	}, [loadList, listWaveKey]);

	useEffect(() => {
		if (!selectedId) {
			setDetail(null);
			return;
		}
		setReplyBody("");
		setNoteBody("");
		void loadDetail(selectedId);
	}, [selectedId, loadDetail]);

	async function refreshAfterAction() {
		await loadList();
		if (selectedId) await loadDetail(selectedId);
	}

	async function submitReply() {
		if (!selectedId || !replyBody.trim()) return;
		setBusy(true);
		try {
			const res = await api.api.staff
				.feedback({ id: selectedId })
				.reply.post({ body: replyBody.trim() });
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Could not send reply"));
				return;
			}
			toast.success("Reply sent to patron");
			setReplyBody("");
			await refreshAfterAction();
		} catch {
			toast.error("Could not send reply");
		} finally {
			setBusy(false);
		}
	}

	async function submitNote() {
		if (!selectedId || !noteBody.trim()) return;
		setBusy(true);
		try {
			const res = await api.api.staff
				.feedback({ id: selectedId })
				.notes.post({ body: noteBody.trim() });
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Could not save note"));
				return;
			}
			toast.success("Internal note added");
			setNoteBody("");
			await refreshAfterAction();
		} catch {
			toast.error("Could not save note");
		} finally {
			setBusy(false);
		}
	}

	async function updateStatus(next: PatronFeedbackStatus) {
		if (!selectedId) return;
		setBusy(true);
		try {
			const res = await api.api.staff
				.feedback({ id: selectedId })
				.status.patch({ status: next });
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Could not update status"));
				return;
			}
			toast.success(
				`Marked ${PATRON_FEEDBACK_STATUS_LABEL[next].toLowerCase()}`,
			);
			await refreshAfterAction();
		} catch {
			toast.error("Could not update status");
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className="mb-10">
			<div className="mb-4 space-y-4">
				<div>
					<h2 className="font-medium text-lg">Feedback</h2>
					<p className="text-muted-foreground text-sm">
						Patron bug reports, ideas, and suggestions — reply in-thread or
						leave internal notes.
					</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
					<SegmentedPillToolbar
						layoutId="staff-feedback-status"
						aria-label="Feedback status filter"
						value={statusFilter}
						onChange={setStatusFilter}
						options={STATUS_FILTER_OPTIONS}
						compact
						className="w-fit max-w-full flex-nowrap"
					/>
					<SegmentedPillToolbar
						layoutId="staff-feedback-category"
						aria-label="Feedback category filter"
						value={categoryFilter}
						onChange={setCategoryFilter}
						options={CATEGORY_FILTER_OPTIONS}
						compact
						className="w-fit max-w-full flex-nowrap"
					/>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
				<div className="rounded-2xl bg-background p-2">
					{loadingList ? (
						<p className="px-2 py-3 text-muted-foreground text-sm">Loading…</p>
					) : items.length === 0 ? (
						<p className="px-2 py-3 text-muted-foreground text-sm">
							No feedback in this filter.
						</p>
					) : (
						<ul className="space-y-1">
							{items.map((row) => {
								const active = row.id === selectedId;
								return (
									<li key={row.id}>
										<button
											type="button"
											className={cn(
												"flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors duration-200",
												active
													? "bg-card text-foreground"
													: "text-muted-foreground [@media(hover:hover)]:hover:bg-card/60 [@media(hover:hover)]:hover:text-foreground",
											)}
											onClick={() => setSelectedId(row.id)}
										>
											<span className="line-clamp-2 font-medium text-sm">
												{row.body}
											</span>
											<span className="mt-0.5 line-clamp-1 text-[11px]">
												{PATRON_FEEDBACK_CATEGORY_LABEL[row.category]} ·{" "}
												{PATRON_FEEDBACK_STATUS_LABEL[row.status]} ·{" "}
												{formatSubmitter(row.submitter)}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				<div className="space-y-5 rounded-2xl bg-background p-4 sm:p-5">
					{loadingDetail && !detail ? (
						<p className="text-muted-foreground text-sm">Loading thread…</p>
					) : detail ? (
						<>
							<div className="flex flex-wrap items-center gap-2">
								<span className="rounded-full bg-card px-2.5 py-0.5 font-medium text-foreground text-xs">
									{PATRON_FEEDBACK_CATEGORY_LABEL[detail.category]}
								</span>
								<span className="text-muted-foreground text-xs">
									{PATRON_FEEDBACK_STATUS_LABEL[detail.status]}
								</span>
								<span className="text-muted-foreground text-xs tabular-nums">
									{formatWhen(detail.createdAt)}
								</span>
							</div>

							<div className="space-y-1">
								<p className="font-medium text-sm">From patron</p>
								<p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed">
									{detail.body}
								</p>
							</div>

							<div className="space-y-1 text-sm">
								<p>
									<span className="text-muted-foreground">Submitter:</span>{" "}
									{detail.submitter.handle ? (
										<Link
											href={`/profile/${detail.submitter.handle}`}
											className="text-foreground underline-offset-2 [@media(hover:hover)]:hover:underline"
											target="_blank"
											rel="noopener noreferrer"
										>
											{formatSubmitter(detail.submitter)}
										</Link>
									) : (
										formatSubmitter(detail.submitter)
									)}
								</p>
								{detail.pageUrl ? (
									<p>
										<span className="text-muted-foreground">Page:</span>{" "}
										<Link
											href={detail.pageUrl}
											className="font-mono text-[11px] text-foreground underline-offset-2 [@media(hover:hover)]:hover:underline"
											target="_blank"
											rel="noopener noreferrer"
										>
											{detail.pageUrl}
										</Link>
									</p>
								) : null}
							</div>

							{detail.replies.length > 0 ? (
								<div className="space-y-3">
									<p className="font-medium text-sm">Patron-visible replies</p>
									{detail.replies.map((reply) => (
										<article
											key={reply.id}
											className="rounded-xl bg-card px-3 py-3"
										>
											<p className="font-medium text-foreground text-xs">
												{reply.authorDisplayName}
											</p>
											<p className="mt-2 whitespace-pre-wrap text-pretty text-sm leading-relaxed">
												{reply.body}
											</p>
											<p className="mt-2 text-muted-foreground text-xs tabular-nums">
												{formatWhen(reply.createdAt)}
											</p>
										</article>
									))}
								</div>
							) : null}

							{detail.staffNotes.length > 0 ? (
								<div className="space-y-3">
									<p className="font-medium text-sm">Internal notes</p>
									{detail.staffNotes.map((note) => (
										<article
											key={note.id}
											className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-3"
										>
											<p className="font-medium text-amber-200 text-xs">
												Internal · {note.authorDisplayName}
											</p>
											<p className="mt-2 whitespace-pre-wrap text-pretty text-amber-50/90 text-sm leading-relaxed">
												{note.body}
											</p>
											<p className="mt-2 text-amber-200/70 text-xs tabular-nums">
												{formatWhen(note.createdAt)}
											</p>
										</article>
									))}
								</div>
							) : null}

							{canReply ? (
								<>
									<div className="space-y-2">
										<Label htmlFor={`${fieldIdBase}-reply`}>
											Reply to patron
										</Label>
										<Textarea
											id={`${fieldIdBase}-reply`}
											value={replyBody}
											onChange={(event) => setReplyBody(event.target.value)}
											rows={4}
											maxLength={2000}
											placeholder="Visible in the patron's My feedback thread…"
											disabled={busy}
										/>
										<Button
											type="button"
											disabled={busy || !replyBody.trim()}
											onClick={() => void submitReply()}
										>
											Send reply
										</Button>
									</div>

									<div className="space-y-2">
										<Label htmlFor={`${fieldIdBase}-note`}>Internal note</Label>
										<Textarea
											id={`${fieldIdBase}-note`}
											value={noteBody}
											onChange={(event) => setNoteBody(event.target.value)}
											rows={3}
											maxLength={2000}
											placeholder="Staff-only context — never shown to patrons"
											disabled={busy}
										/>
										<Button
											type="button"
											variant="secondary"
											disabled={busy || !noteBody.trim()}
											onClick={() => void submitNote()}
										>
											Add internal note
										</Button>
									</div>

									<div className="space-y-2">
										<p className="font-medium text-sm">Status</p>
										<div className="flex flex-wrap gap-2">
											{(["open", "resolved", "dismissed"] as const).map(
												(status) => (
													<Button
														key={status}
														type="button"
														variant={
															detail.status === status ? "default" : "secondary"
														}
														disabled={busy || detail.status === status}
														onClick={() => void updateStatus(status)}
													>
														{PATRON_FEEDBACK_STATUS_LABEL[status]}
													</Button>
												),
											)}
										</div>
									</div>
								</>
							) : (
								<p className="text-muted-foreground text-sm">
									Reply, internal notes, and status changes require owner or
									admin.
								</p>
							)}
						</>
					) : (
						<p className="text-muted-foreground text-sm">
							Select feedback to review.
						</p>
					)}
				</div>
			</div>
		</section>
	);
}
