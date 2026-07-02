"use client";

import { Button } from "@still/ui/components/button";
import { ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import {
	fetchPatronFeedbackDetail,
	fetchPatronFeedbackList,
	markPatronFeedbackRead,
} from "@/lib/fetch-patron-feedback-client";
import { formatDistanceToNowStrict } from "@/lib/format";
import {
	isPatronFeedbackUnread,
	PATRON_FEEDBACK_CATEGORY_LABEL,
	PATRON_FEEDBACK_STATUS_LABEL,
	type PatronFeedbackDetail,
	type PatronFeedbackListItem,
} from "@/lib/patron-feedback-client";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

type FeedbackDrawerMode = "list" | "thread";

/** Patron history drawer — list view + thread detail with staff replies. */
export function FeedbackDrawer({
	open,
	onOpenChange,
	mode,
	threadId,
	onOpenCompose,
	onBackToList,
	onSelectThread,
	listRefreshKey = 0,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: FeedbackDrawerMode;
	threadId: string | null;
	onOpenCompose: () => void;
	onBackToList: () => void;
	onSelectThread: (feedbackId: string) => void;
	/** Bump after a new submission to reload the list. */
	listRefreshKey?: number;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [items, setItems] = useState<PatronFeedbackListItem[]>([]);
	const [thread, setThread] = useState<PatronFeedbackDetail | null>(null);
	const [loadingList, setLoadingList] = useState(false);
	const [loadingThread, setLoadingThread] = useState(false);

	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
	);

	const loadList = useCallback(async () => {
		setLoadingList(true);
		try {
			const rows = await fetchPatronFeedbackList();
			setItems(rows);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Could not load feedback",
			);
		} finally {
			setLoadingList(false);
		}
	}, []);

	const loadThread = useCallback(async (id: string) => {
		setLoadingThread(true);
		try {
			const detail = await fetchPatronFeedbackDetail(id);
			setThread(detail);
			await markPatronFeedbackRead(id).catch(() => undefined);
			setItems((prev) =>
				prev.map((row) =>
					row.id === id
						? { ...row, patronLastReadAt: new Date().toISOString() }
						: row,
				),
			);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Could not load feedback",
			);
		} finally {
			setLoadingThread(false);
		}
	}, []);

	const listWaveKey = `${open}:${mode}:${listRefreshKey}`;

	useEffect(() => {
		if (!open || mode !== "list") return;
		void loadList();
	}, [listWaveKey, loadList, open, mode]);

	useEffect(() => {
		if (!open || mode !== "thread" || !threadId) return;
		void loadThread(threadId);
	}, [open, mode, threadId, loadThread]);

	const title = mode === "list" ? "My feedback" : "Feedback thread";
	const description =
		mode === "list"
			? "Your past submissions and replies from the Sense team."
			: "Your message and any replies from the team.";

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			appStack
			handleLeading={
				mode === "thread" ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-10 rounded-full bg-background"
						aria-label="Back to feedback list"
						onClick={onBackToList}
					>
						<ChevronLeft className="size-5" aria-hidden />
					</Button>
				) : undefined
			}
		>
			<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
				<DetailDrawerScrollBody scrollRef={scrollRef}>
					<div className="mx-auto w-full max-w-xl px-4 pt-2 pb-10">
						{mode === "list" ? (
							<FeedbackListBody
								items={items}
								loading={loadingList}
								onOpenCompose={onOpenCompose}
								onSelectThread={onSelectThread}
							/>
						) : (
							<FeedbackThreadBody thread={thread} loading={loadingThread} />
						)}
					</div>
				</DetailDrawerScrollBody>
				<SheetScrollScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
					footerTone="filmography"
				/>
			</div>
		</DetailVaulSheet>
	);
}

function FeedbackListBody({
	items,
	loading,
	onOpenCompose,
	onSelectThread,
}: {
	items: PatronFeedbackListItem[];
	loading: boolean;
	onOpenCompose: () => void;
	onSelectThread: (feedbackId: string) => void;
}) {
	if (loading && items.length === 0) {
		return (
			<div className="flex justify-center py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center gap-4 py-16 text-center">
				<p className="text-balance font-medium text-base text-foreground">
					No feedback yet
				</p>
				<p className="max-w-xs text-pretty text-muted-foreground text-sm">
					Share a bug, idea, or suggestion — we read every submission.
				</p>
				<Button
					type="button"
					size="pill"
					className="min-h-10 font-semibold"
					onClick={onOpenCompose}
				>
					Send feedback
				</Button>
			</div>
		);
	}

	return (
		<ul className="space-y-2">
			{items.map((item) => (
				<FeedbackListRow
					key={item.id}
					item={item}
					onSelect={() => onSelectThread(item.id)}
				/>
			))}
		</ul>
	);
}

function FeedbackListRow({
	item,
	onSelect,
}: {
	item: PatronFeedbackListItem;
	onSelect: () => void;
}) {
	const unread = isPatronFeedbackUnread(item);
	return (
		<li>
			<button
				type="button"
				className="w-full rounded-[1.25rem] bg-background px-4 py-3 text-left transition-colors duration-200 [@media(hover:hover)]:hover:bg-card"
				onClick={onSelect}
			>
				<div className="flex items-start gap-2">
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<span className="rounded-full bg-card px-2.5 py-0.5 font-medium text-foreground text-xs">
								{PATRON_FEEDBACK_CATEGORY_LABEL[item.category]}
							</span>
							<span className="text-muted-foreground text-xs">
								{PATRON_FEEDBACK_STATUS_LABEL[item.status]}
							</span>
							<span className="text-muted-foreground text-xs tabular-nums">
								{formatDistanceToNowStrict(new Date(item.createdAt))} ago
							</span>
						</div>
						<p className="mt-2 line-clamp-2 text-pretty text-foreground text-sm leading-relaxed">
							{item.body}
						</p>
					</div>
					{unread ? (
						<>
							<span
								className="mt-1 size-2 shrink-0 rounded-full bg-foreground"
								aria-hidden
							/>
							<span className="sr-only">Unread reply</span>
						</>
					) : null}
				</div>
			</button>
		</li>
	);
}

function FeedbackThreadBody({
	thread,
	loading,
}: {
	thread: PatronFeedbackDetail | null;
	loading: boolean;
}) {
	if (loading && !thread) {
		return (
			<div className="flex justify-center py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!thread) {
		return (
			<p className="py-12 text-center text-muted-foreground text-sm">
				Could not load this thread.
			</p>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-2">
				<span className="rounded-full bg-background px-2.5 py-0.5 font-medium text-foreground text-xs">
					{PATRON_FEEDBACK_CATEGORY_LABEL[thread.category]}
				</span>
				<span className="text-muted-foreground text-xs">
					{PATRON_FEEDBACK_STATUS_LABEL[thread.status]}
				</span>
			</div>

			<article className="rounded-[1.25rem] bg-background px-4 py-3">
				<p className="font-medium text-muted-foreground text-xs">You</p>
				<p className="mt-2 whitespace-pre-wrap text-pretty text-foreground text-sm leading-relaxed">
					{thread.body}
				</p>
				<p className="mt-2 text-muted-foreground text-xs tabular-nums">
					{formatDistanceToNowStrict(new Date(thread.createdAt))} ago
				</p>
				{thread.pageUrl ? (
					<p className="mt-2 text-muted-foreground text-xs">
						Submitted from{" "}
						<Link
							href={thread.pageUrl}
							className="font-mono text-[11px] text-foreground underline-offset-2 [@media(hover:hover)]:hover:underline"
						>
							{thread.pageUrl}
						</Link>
					</p>
				) : null}
			</article>

			{thread.replies.length > 0 ? (
				<div className="space-y-3">
					<h3 className="font-semibold text-foreground text-sm">Replies</h3>
					{thread.replies.map((reply) => (
						<article
							key={reply.id}
							className="rounded-[1.25rem] bg-card px-4 py-3"
						>
							<p className="font-medium text-foreground text-xs">
								{reply.authorDisplayName}
							</p>
							<p className="mt-2 whitespace-pre-wrap text-pretty text-foreground text-sm leading-relaxed">
								{reply.body}
							</p>
							<p className="mt-2 text-muted-foreground text-xs tabular-nums">
								{formatDistanceToNowStrict(new Date(reply.createdAt))} ago
							</p>
						</article>
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">
					No replies yet — the team will respond here when they can.
				</p>
			)}
		</div>
	);
}
