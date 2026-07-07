"use client";

import { Button } from "@still/ui/components/button";
import IconHeart from "@still/ui/icons/heart";
import IconHeartFilled from "@still/ui/icons/heart-filled";
import { cn } from "@still/ui/lib/utils";
import { Loader2, ThumbsDown, X } from "lucide-react";
import Link from "next/link";
import { type RefObject, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
	type FeedPerson,
	FeedPersonAvatar,
} from "@/components/feed/feed-person-avatar";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import {
	MentionTextarea,
	type MentionTextareaListingContext,
} from "@/components/review/mention-textarea";
import { BodyWithMentions } from "@/components/review/review-body-with-mentions";
import { CommentDeleteConfirmDialog } from "@/components/social/comment-delete-confirm-dialog";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { migrateLegacyListingMentions } from "@/lib/content-mentions";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatDistanceToNowStrict } from "@/lib/format";
import {
	SHEET_FIELD_CLASS,
	SHEET_PRIMARY_PILL_CLASS,
} from "@/lib/sheet-chrome";

type Kind = "review" | "list" | "post" | "log";

export type CommentReactionSnapshot = {
	liked: boolean;
	likes: number;
	disliked: boolean;
	dislikes: number;
};

export type CommentRow = {
	comment: {
		id: string;
		userId: string;
		body: string;
		createdAt: string;
		editedAt?: string | null;
		replyToId: string | null;
		likesCount: number;
		dislikesCount: number;
	};
	user: { name: string; image: string | null } | null;
	profile: { handle: string; displayName: string } | null;
	liked: boolean;
	disliked: boolean;
};

type ApiCommentReactionSnapshot = {
	liked?: boolean;
	disliked?: boolean;
	likesCount?: number;
	dislikesCount?: number;
};

function parseCommentReactionSnapshot(
	data: ApiCommentReactionSnapshot | null,
	fallback: CommentReactionSnapshot,
): CommentReactionSnapshot {
	return {
		liked: data?.liked ?? fallback.liked,
		likes:
			typeof data?.likesCount === "number" ? data.likesCount : fallback.likes,
		disliked: data?.disliked ?? fallback.disliked,
		dislikes:
			typeof data?.dislikesCount === "number"
				? data.dislikesCount
				: fallback.dislikes,
	};
}

function commentPerson(row: CommentRow): FeedPerson {
	return {
		user: row.user
			? { id: row.comment.userId, name: row.user.name, image: row.user.image }
			: null,
		profile: row.profile,
	};
}

function patronDisplayName(row: CommentRow): string {
	return row.profile?.displayName ?? row.user?.name ?? "Someone";
}

function patronHandle(row: CommentRow): string | null {
	return row.profile?.handle ?? null;
}

/** Normalize comment API rows — likes + viewer state may be absent on older payloads. */
export function normalizeCommentRows(rows: unknown): CommentRow[] {
	if (!Array.isArray(rows)) return [];
	return rows
		.map((row) => {
			const entry = row as Partial<CommentRow> & {
				comment?: Partial<CommentRow["comment"]>;
			};
			return {
				comment: {
					id: entry.comment?.id ?? "",
					userId: entry.comment?.userId ?? "",
					body: entry.comment?.body ?? "",
					createdAt: entry.comment?.createdAt ?? new Date().toISOString(),
					editedAt: entry.comment?.editedAt ?? null,
					replyToId: entry.comment?.replyToId ?? null,
					likesCount: entry.comment?.likesCount ?? 0,
					dislikesCount: entry.comment?.dislikesCount ?? 0,
				},
				user: entry.user ?? null,
				profile: entry.profile ?? null,
				liked: entry.liked ?? false,
				disliked: entry.disliked ?? false,
			};
		})
		.filter((row) => row.comment.id.length > 0);
}

function isScrollNearBottom(element: HTMLElement, thresholdPx = 120): boolean {
	return (
		element.scrollHeight - element.scrollTop - element.clientHeight <=
		thresholdPx
	);
}

/** Group flat API rows into roots + children keyed by `replyToId`. */
function buildCommentTree(comments: CommentRow[]) {
	const byId = new Map(comments.map((row) => [row.comment.id, row]));
	const childrenByParentId = new Map<string, CommentRow[]>();
	const roots: CommentRow[] = [];

	for (const row of comments) {
		const parentId = row.comment.replyToId;
		if (parentId && byId.has(parentId)) {
			const siblings = childrenByParentId.get(parentId) ?? [];
			siblings.push(row);
			childrenByParentId.set(parentId, siblings);
		} else {
			roots.push(row);
		}
	}

	return { byId, childrenByParentId, roots };
}

/** Like + dislike toggles — mutually exclusive, backed by comment reaction routes. */
function CommentReactionButtons({
	commentId,
	likesCount,
	dislikesCount,
	liked,
	disliked,
	disabled,
	appearance,
	onChange,
}: {
	commentId: string;
	likesCount: number;
	dislikesCount: number;
	liked: boolean;
	disliked: boolean;
	disabled?: boolean;
	appearance: "default" | "sheet";
	onChange: (state: CommentReactionSnapshot) => void;
}) {
	const [likeBusy, setLikeBusy] = useState(false);
	const [dislikeBusy, setDislikeBusy] = useState(false);
	const { data: session } = authClient.useSession();
	const isSheet = appearance === "sheet";
	const busy = likeBusy || dislikeBusy;

	const fallback: CommentReactionSnapshot = {
		liked,
		likes: likesCount,
		disliked,
		dislikes: dislikesCount,
	};

	function requireSignedIn(): boolean {
		if (session?.user) return true;
		toast.error("Sign in to react to comments");
		return false;
	}

	async function toggleLike() {
		if (!requireSignedIn()) return;
		setLikeBusy(true);
		try {
			const res = await api.api.comments({ id: commentId }).like.post({});
			onChange(
				parseCommentReactionSnapshot(
					res.data as ApiCommentReactionSnapshot | null,
					fallback,
				),
			);
		} catch (err) {
			console.error(err);
			toast.error("Couldn't update like");
		} finally {
			setLikeBusy(false);
		}
	}

	async function toggleDislike() {
		if (!requireSignedIn()) return;
		setDislikeBusy(true);
		try {
			const res = await api.api.comments({ id: commentId }).dislike.post({});
			onChange(
				parseCommentReactionSnapshot(
					res.data as ApiCommentReactionSnapshot | null,
					fallback,
				),
			);
		} catch (err) {
			console.error(err);
			toast.error("Couldn't update dislike");
		} finally {
			setDislikeBusy(false);
		}
	}

	const likeLabel = liked ? "Unlike comment" : "Like comment";
	const dislikeLabel = disliked ? "Remove dislike" : "Dislike comment";

	const sheetButtonClass =
		"inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs tabular-nums transition-colors duration-150 motion-reduce:transition-none";

	if (isSheet) {
		return (
			<>
				<button
					type="button"
					disabled={disabled || busy}
					className={cn(
						sheetButtonClass,
						liked ? "text-foreground" : "text-muted-foreground",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					aria-pressed={liked}
					aria-label={likeLabel}
					onClick={() => void toggleLike()}
				>
					{likeBusy ? (
						<Loader2 className="size-3.5 animate-spin" aria-hidden />
					) : liked ? (
						<IconHeartFilled size="16px" className="shrink-0" aria-hidden />
					) : (
						<IconHeart
							size="16px"
							className="shrink-0 opacity-80"
							aria-hidden
						/>
					)}
					{likesCount > 0 ? <span>{likesCount}</span> : null}
				</button>
				<button
					type="button"
					disabled={disabled || busy}
					className={cn(
						sheetButtonClass,
						disliked ? "text-foreground" : "text-muted-foreground",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					aria-pressed={disliked}
					aria-label={dislikeLabel}
					onClick={() => void toggleDislike()}
				>
					{dislikeBusy ? (
						<Loader2 className="size-3.5 animate-spin" aria-hidden />
					) : (
						<ThumbsDown
							className={cn(
								"size-4 shrink-0 opacity-80",
								disliked && "fill-current opacity-100",
							)}
							aria-hidden
						/>
					)}
					{dislikesCount > 0 ? <span>{dislikesCount}</span> : null}
				</button>
			</>
		);
	}

	return (
		<>
			<button
				type="button"
				disabled={disabled || busy}
				className="inline-flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-desert-orange"
				aria-pressed={liked}
				aria-label={likeLabel}
				onClick={() => void toggleLike()}
			>
				{likeBusy ? (
					<Loader2 className="size-3.5 animate-spin" aria-hidden />
				) : (
					<span className="inline-flex size-3.5 items-center justify-center">
						{liked ? (
							<IconHeartFilled
								size="14px"
								className="text-desert-orange"
								aria-hidden
							/>
						) : (
							<IconHeart size="14px" aria-hidden />
						)}
					</span>
				)}
				{likesCount > 0 ? likesCount : "Like"}
			</button>
			<button
				type="button"
				disabled={disabled || busy}
				className="inline-flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
				aria-pressed={disliked}
				aria-label={dislikeLabel}
				onClick={() => void toggleDislike()}
			>
				{dislikeBusy ? (
					<Loader2 className="size-3.5 animate-spin" aria-hidden />
				) : (
					<ThumbsDown
						className={cn(
							"size-3.5",
							disliked && "fill-current text-foreground",
						)}
						aria-hidden
					/>
				)}
				{dislikesCount > 0 ? dislikesCount : "Dislike"}
			</button>
		</>
	);
}

function CommentReplyContext({
	replyTo,
	appearance,
}: {
	replyTo: CommentRow;
	appearance: "default" | "sheet";
}) {
	const replyHandle = patronHandle(replyTo);
	const replyName = patronDisplayName(replyTo);
	const isSheet = appearance === "sheet";

	return (
		<p
			className={cn(
				"text-muted-foreground",
				isSheet ? "mb-1 text-xs" : "mb-0.5 text-[11px]",
			)}
		>
			Replying to{" "}
			{replyHandle ? (
				<Link
					href={`/profile/${replyHandle}`}
					className="font-medium text-foreground/80 hover:underline"
				>
					@{replyHandle}
				</Link>
			) : (
				<span className="font-medium text-foreground/80">{replyName}</span>
			)}
		</p>
	);
}

function CommentListItem({
	row,
	appearance,
	isReply = false,
	replyTo = null,
	viewerUserId,
	isEditing = false,
	editDraft = "",
	editBusy = false,
	onReply,
	onReactionChange,
	onStartEdit,
	onCancelEdit,
	onEditDraftChange,
	onSaveEdit,
	onRequestDelete,
	listingContext = null,
}: {
	row: CommentRow;
	appearance: "default" | "sheet";
	/** Nested under a parent comment — indented with reply context. */
	isReply?: boolean;
	replyTo?: CommentRow | null;
	/** Review movie/TV context — title cast-first `@` picker in edit mode. */
	listingContext?: MentionTextareaListingContext | null;
	viewerUserId: string | null;
	isEditing?: boolean;
	editDraft?: string;
	editBusy?: boolean;
	onReply: (commentId: string) => void;
	onReactionChange: (commentId: string, state: CommentReactionSnapshot) => void;
	onStartEdit: (commentId: string, body: string) => void;
	onCancelEdit: () => void;
	onEditDraftChange: (value: string) => void;
	onSaveEdit: (commentId: string) => void;
	onRequestDelete: (commentId: string) => void;
}) {
	const isSheet = appearance === "sheet";
	const person = commentPerson(row);
	const handle = row.profile?.handle;
	const name = patronDisplayName(row);
	const timeLabel = `${formatDistanceToNowStrict(new Date(row.comment.createdAt))} ago`;
	const isOwner = viewerUserId != null && row.comment.userId === viewerUserId;
	const ownerActionClass = cn(
		"h-8 rounded-full px-2.5 text-muted-foreground text-xs",
		isSheet && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	);

	const ownerActions = isOwner ? (
		<>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={ownerActionClass}
				disabled={isEditing || editBusy}
				onClick={() => onStartEdit(row.comment.id, row.comment.body)}
			>
				Edit
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={cn(ownerActionClass, "text-destructive")}
				disabled={isEditing || editBusy}
				onClick={() => onRequestDelete(row.comment.id)}
			>
				Delete
			</Button>
		</>
	) : null;

	const bodyBlock = isEditing ? (
		<div className="mt-2 space-y-2">
			<MentionTextarea
				id={`comment-edit-${row.comment.id}`}
				rows={isSheet ? 3 : 2}
				maxLength={4000}
				value={editDraft}
				onChange={onEditDraftChange}
				listingContext={listingContext}
				className={cn(
					isSheet &&
						cn(
							SHEET_FIELD_CLASS,
							"min-h-[5.5rem] resize-y py-3 leading-relaxed",
						),
				)}
			/>
			<div className="flex flex-wrap items-center gap-2">
				{isSheet ? (
					<DetailMotionButtonWrap>
						<Button
							type="button"
							variant="default"
							size="pill"
							className={SHEET_PRIMARY_PILL_CLASS}
							disabled={editBusy || !editDraft.trim()}
							onClick={() => onSaveEdit(row.comment.id)}
						>
							{editBusy ? (
								<Loader2 className="size-3.5 animate-spin" aria-hidden />
							) : null}
							Save
						</Button>
					</DetailMotionButtonWrap>
				) : (
					<Button
						type="button"
						variant="accent"
						size="sm"
						disabled={editBusy || !editDraft.trim()}
						onClick={() => onSaveEdit(row.comment.id)}
					>
						{editBusy ? (
							<Loader2 className="size-3.5 animate-spin" aria-hidden />
						) : null}
						Save
					</Button>
				)}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={ownerActionClass}
					disabled={editBusy}
					onClick={onCancelEdit}
				>
					Cancel
				</Button>
			</div>
		</div>
	) : (
		<p
			className={cn(
				"whitespace-pre-wrap text-foreground/90",
				isSheet ? "mt-2 text-sm leading-relaxed" : "mt-1",
			)}
		>
			<BodyWithMentions body={row.comment.body} />
		</p>
	);

	if (isSheet) {
		return (
			<div
				id={`comment-${row.comment.id}`}
				className={cn(
					"flex items-start gap-3",
					isReply ? "py-1 pl-1" : "rounded-2xl bg-background p-4",
				)}
			>
				<FeedPersonAvatar person={person} size={isReply ? "xs" : "sm"} />
				<div className="min-w-0 flex-1">
					{isReply && replyTo ? (
						<CommentReplyContext replyTo={replyTo} appearance="sheet" />
					) : null}
					<header className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm leading-snug">
						{handle ? (
							<Link
								href={`/profile/${handle}`}
								className="font-medium text-foreground hover:underline"
							>
								{name}
							</Link>
						) : (
							<span className="font-medium text-foreground">{name}</span>
						)}
						<span className="text-muted-foreground text-xs tabular-nums">
							· {timeLabel}
							{row.comment.editedAt ? " · edited" : null}
						</span>
					</header>
					{bodyBlock}
					{!isEditing ? (
						<div className="mt-2.5 flex flex-wrap items-center gap-0.5">
							<CommentReactionButtons
								commentId={row.comment.id}
								likesCount={row.comment.likesCount}
								dislikesCount={row.comment.dislikesCount}
								liked={row.liked}
								disliked={row.disliked}
								appearance="sheet"
								onChange={(state) => onReactionChange(row.comment.id, state)}
							/>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className={ownerActionClass}
								onClick={() => onReply(row.comment.id)}
							>
								Reply
							</Button>
							{ownerActions}
						</div>
					) : null}
				</div>
			</div>
		);
	}

	return (
		<div
			id={`comment-${row.comment.id}`}
			className={cn(
				isReply
					? "border-border/40 border-l py-1 pl-3"
					: "rounded-2xl bg-card/60 p-3",
			)}
		>
			{isReply && replyTo ? (
				<CommentReplyContext replyTo={replyTo} appearance="default" />
			) : null}
			<header className="text-muted-foreground text-xs">
				{handle ? (
					<Link
						href={`/profile/${handle}`}
						className="font-medium text-foreground hover:text-desert-orange"
					>
						{name}
					</Link>
				) : (
					<span className="font-medium text-foreground">{name}</span>
				)}{" "}
				· {timeLabel}
				{row.comment.editedAt ? " · edited" : null}
			</header>
			{bodyBlock}
			{!isEditing ? (
				<div className="mt-2 flex flex-wrap items-center gap-3">
					<CommentReactionButtons
						commentId={row.comment.id}
						likesCount={row.comment.likesCount}
						dislikesCount={row.comment.dislikesCount}
						liked={row.liked}
						disliked={row.disliked}
						appearance="default"
						onChange={(state) => onReactionChange(row.comment.id, state)}
					/>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 px-2 text-muted-foreground text-xs hover:text-foreground"
						onClick={() => onReply(row.comment.id)}
					>
						Reply
					</Button>
					{ownerActions}
				</div>
			) : null}
		</div>
	);
}

function CommentThreadBranch({
	row,
	replyTo,
	childrenByParentId,
	appearance,
	viewerUserId,
	editingCommentId,
	editDraft,
	editBusy,
	onReply,
	onReactionChange,
	onStartEdit,
	onCancelEdit,
	onEditDraftChange,
	onSaveEdit,
	onRequestDelete,
	listingContext = null,
}: {
	row: CommentRow;
	replyTo: CommentRow | null;
	childrenByParentId: Map<string, CommentRow[]>;
	appearance: "default" | "sheet";
	listingContext?: MentionTextareaListingContext | null;
	viewerUserId: string | null;
	editingCommentId: string | null;
	editDraft: string;
	editBusy: boolean;
	onReply: (commentId: string) => void;
	onReactionChange: (commentId: string, state: CommentReactionSnapshot) => void;
	onStartEdit: (commentId: string, body: string) => void;
	onCancelEdit: () => void;
	onEditDraftChange: (value: string) => void;
	onSaveEdit: (commentId: string) => void;
	onRequestDelete: (commentId: string) => void;
}) {
	const isReply = replyTo != null;
	const childRows = childrenByParentId.get(row.comment.id) ?? [];

	return (
		<li className={cn("text-sm", !isReply && "space-y-3")}>
			<CommentListItem
				row={row}
				appearance={appearance}
				isReply={isReply}
				replyTo={replyTo}
				listingContext={listingContext}
				viewerUserId={viewerUserId}
				isEditing={editingCommentId === row.comment.id}
				editDraft={editDraft}
				editBusy={editBusy}
				onReply={onReply}
				onReactionChange={onReactionChange}
				onStartEdit={onStartEdit}
				onCancelEdit={onCancelEdit}
				onEditDraftChange={onEditDraftChange}
				onSaveEdit={onSaveEdit}
				onRequestDelete={onRequestDelete}
			/>
			{childRows.length > 0 ? (
				<ul
					className={cn(
						"space-y-3",
						appearance === "sheet"
							? "mt-2 ml-5 border-border/35 border-l pl-3"
							: "mt-2 ml-3 space-y-2",
					)}
				>
					{childRows.map((child) => (
						<CommentThreadBranch
							key={child.comment.id}
							row={child}
							replyTo={row}
							childrenByParentId={childrenByParentId}
							appearance={appearance}
							listingContext={listingContext}
							viewerUserId={viewerUserId}
							editingCommentId={editingCommentId}
							editDraft={editDraft}
							editBusy={editBusy}
							onReply={onReply}
							onReactionChange={onReactionChange}
							onStartEdit={onStartEdit}
							onCancelEdit={onCancelEdit}
							onEditDraftChange={onEditDraftChange}
							onSaveEdit={onSaveEdit}
							onRequestDelete={onRequestDelete}
						/>
					))}
				</ul>
			) : null}
		</li>
	);
}

/** Threaded comment list with composer at the top. */
export function CommentsThread({
	targetKind,
	targetId,
	initialComments,
	appearance = "default",
	scrollRootRef,
	liveRefreshSignal = 0,
	liveRefreshCommentId = null,
	onCommentsChange,
	listingContext = null,
}: {
	targetKind: Kind;
	targetId: string;
	initialComments: CommentRow[];
	/** Review movie/TV context for `#` / `@` mention pickers. */
	listingContext?: MentionTextareaListingContext | null;
	/** `sheet` — feed-style rows on `bg-background` + composer primary pill (review reader). */
	appearance?: "default" | "sheet";
	/** Scrollport for the review reader — used to detect off-screen live comments. */
	scrollRootRef?: RefObject<HTMLElement | null>;
	/** Incremented by SSE subscriber to refetch comments while the drawer stays open. */
	liveRefreshSignal?: number;
	/** When set, skip refetch if this comment is already in local state (own optimistic post). */
	liveRefreshCommentId?: string | null;
	/** Patron thread changed — parent syncs counts only (not comment rows). */
	onCommentsChange?: (comments: CommentRow[]) => void;
}) {
	const [comments, setComments] = useState(initialComments);
	const commentsRef = useRef(comments);
	commentsRef.current = comments;
	/** Invalidates in-flight SSE refetches after local post/delete. */
	const refreshGenerationRef = useRef(0);
	/** Skip SSE refetch briefly after local post/delete to avoid stale overwrites. */
	const suppressLiveRefreshUntilRef = useRef(0);
	const [body, setBody] = useState("");
	const [replyToId, setReplyToId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
	const [editDraft, setEditDraft] = useState("");
	const [editBusy, setEditBusy] = useState(false);
	const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
	const [deleteBusy, setDeleteBusy] = useState(false);
	const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
	const listEndRef = useRef<HTMLDivElement>(null);
	const isSheet = appearance === "sheet";
	const { data: session } = authClient.useSession();
	const viewerUserId = session?.user?.id ?? null;
	const onCommentsChangeRef = useRef(onCommentsChange);
	onCommentsChangeRef.current = onCommentsChange;
	const skipCommentsChangeNotifyRef = useRef(true);

	function applyComments(next: CommentRow[]) {
		setComments(next);
	}

	function applyCommentsUpdate(
		updater: (current: CommentRow[]) => CommentRow[],
	) {
		setComments(updater);
	}

	// Notify parent after commit — never call setState upstream inside our setState updater.
	useEffect(() => {
		if (skipCommentsChangeNotifyRef.current) {
			skipCommentsChangeNotifyRef.current = false;
			return;
		}
		onCommentsChangeRef.current?.(comments);
	}, [comments]);

	function suppressLiveRefresh(ms = 4_000) {
		suppressLiveRefreshUntilRef.current = Date.now() + ms;
		refreshGenerationRef.current += 1;
	}

	useEffect(() => {
		if (!liveRefreshSignal) return;
		if (Date.now() < suppressLiveRefreshUntilRef.current) return;

		// Own optimistic post already applied — no need to refetch and risk a stale wipe.
		if (
			liveRefreshCommentId &&
			commentsRef.current.some((row) => row.comment.id === liveRefreshCommentId)
		) {
			return;
		}

		let cancelled = false;
		const generation = refreshGenerationRef.current + 1;
		refreshGenerationRef.current = generation;

		async function refreshFromServer() {
			try {
				const res = await api.api.comments
					.of({ parentType: targetKind })({ parentId: targetId })
					.get();
				if (cancelled || generation !== refreshGenerationRef.current) return;
				if (res.error) return;

				const next = normalizeCommentRows(res.data);
				// Never replace a visible thread with an empty/error-shaped payload.
				if (next.length === 0 && commentsRef.current.length > 0) return;

				const scrollEl = scrollRootRef?.current;
				const atBottom = !scrollEl || isScrollNearBottom(scrollEl);

				applyComments(next);

				if (atBottom) {
					setHasUnreadBelow(false);
					listEndRef.current?.scrollIntoView({
						behavior: "smooth",
						block: "end",
					});
				} else {
					setHasUnreadBelow(true);
				}
			} catch (err) {
				console.error(err);
			}
		}

		void refreshFromServer();

		return () => {
			cancelled = true;
		};
	}, [
		liveRefreshSignal,
		liveRefreshCommentId,
		scrollRootRef,
		targetId,
		targetKind,
	]);

	function scrollToLatestComment() {
		setHasUnreadBelow(false);
		listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}

	const replyTarget = replyToId
		? comments.find((row) => row.comment.id === replyToId)
		: null;
	const replyHandle = replyTarget?.profile?.handle;
	const { childrenByParentId, roots } = buildCommentTree(comments);

	function startReply(commentId: string) {
		setReplyToId(commentId);
	}

	function clearReply() {
		setReplyToId(null);
	}

	function updateCommentReaction(
		commentId: string,
		state: CommentReactionSnapshot,
	) {
		setComments((current) =>
			current.map((row) =>
				row.comment.id === commentId
					? {
							...row,
							liked: state.liked,
							disliked: state.disliked,
							comment: {
								...row.comment,
								likesCount: state.likes,
								dislikesCount: state.dislikes,
							},
						}
					: row,
			),
		);
	}

	function startEdit(commentId: string, currentBody: string) {
		setEditingCommentId(commentId);
		setEditDraft(currentBody);
		setReplyToId(null);
	}

	function cancelEdit() {
		setEditingCommentId(null);
		setEditDraft("");
	}

	async function saveEdit(commentId: string) {
		const trimmed = migrateLegacyListingMentions(editDraft.trim());
		if (!trimmed) return;
		setEditBusy(true);
		try {
			const res = await api.api.comments({ id: commentId }).patch({
				body: trimmed,
			});
			const updated = res.data as {
				body?: string;
				editedAt?: string | Date | null;
			} | null;
			applyCommentsUpdate((current) =>
				current.map((row) =>
					row.comment.id === commentId
						? {
								...row,
								comment: {
									...row.comment,
									body: updated?.body ?? trimmed,
									editedAt:
										updated?.editedAt != null
											? String(updated.editedAt)
											: new Date().toISOString(),
								},
							}
						: row,
				),
			);
			setEditingCommentId(null);
			setEditDraft("");
		} catch (err) {
			console.error(err);
			toast.error("Couldn't update comment");
		} finally {
			setEditBusy(false);
		}
	}

	function requestDelete(commentId: string) {
		setDeleteTargetId(commentId);
	}

	async function confirmDelete() {
		if (!deleteTargetId) return;
		suppressLiveRefresh();
		setDeleteBusy(true);
		try {
			await api.api.comments({ id: deleteTargetId }).delete();
			applyCommentsUpdate((current) =>
				current.filter((row) => row.comment.id !== deleteTargetId),
			);
			if (replyToId === deleteTargetId) setReplyToId(null);
			if (editingCommentId === deleteTargetId) cancelEdit();
			setDeleteTargetId(null);
		} catch (err) {
			console.error(err);
			toast.error("Couldn't delete comment");
		} finally {
			setDeleteBusy(false);
		}
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = migrateLegacyListingMentions(body.trim());
		if (!trimmed) return;
		suppressLiveRefresh();
		setBusy(true);
		try {
			const res = await api.api.comments.post({
				parentType: targetKind,
				parentId: targetId,
				body: trimmed,
				...(replyToId ? { replyToId } : {}),
			});
			const row = res.data as CommentRow["comment"] | null;
			if (row) {
				// Append so chronological order matches API + keeps replies near parents.
				const patronName = session?.user?.name ?? "You";
				const patronImage = session?.user?.image ?? null;
				applyCommentsUpdate((current) => [
					...current,
					{
						comment: {
							...row,
							likesCount: row.likesCount ?? 0,
							dislikesCount: row.dislikesCount ?? 0,
						},
						user: { name: patronName, image: patronImage },
						profile: null,
						liked: false,
						disliked: false,
					} satisfies CommentRow,
				]);
			}
			setBody("");
			setReplyToId(null);
		} catch (err) {
			console.error(err);
			toast.error("Couldn't post comment");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="space-y-6">
			{hasUnreadBelow && isSheet ? (
				<div className="flex justify-center">
					<Button
						type="button"
						variant="secondary"
						size="pill"
						className="h-8 rounded-full px-4 text-xs"
						onClick={scrollToLatestComment}
					>
						New
					</Button>
				</div>
			) : null}
			<form onSubmit={submit} className="space-y-3">
				{replyToId ? (
					<div
						className={cn(
							"flex items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm",
							isSheet ? "bg-background" : "bg-card/60",
						)}
					>
						<p className="text-muted-foreground">
							Replying to{" "}
							<span className="font-medium text-foreground">
								{replyTarget ? patronDisplayName(replyTarget) : "comment"}
							</span>
						</p>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="shrink-0"
							aria-label="Cancel reply"
							onClick={clearReply}
						>
							<X className="size-4" aria-hidden />
						</Button>
					</div>
				) : null}
				<MentionTextarea
					id="comment-compose"
					rows={isSheet ? 4 : 3}
					maxLength={2000}
					value={body}
					onChange={setBody}
					listingContext={listingContext}
					placeholder={
						replyHandle
							? `Reply to @${replyHandle}…`
							: "Share a thought… Use # for films and @ for people."
					}
					className={cn(
						isSheet &&
							cn(
								SHEET_FIELD_CLASS,
								"min-h-[6.5rem] resize-y py-3 leading-relaxed",
							),
					)}
				/>
				<div className={cn("flex", isSheet ? "justify-center" : "justify-end")}>
					{isSheet ? (
						<DetailMotionButtonWrap>
							<Button
								type="submit"
								variant="default"
								size="pill"
								className={SHEET_PRIMARY_PILL_CLASS}
								disabled={busy || !body.trim()}
							>
								{busy ? (
									<Loader2 className="size-3.5 animate-spin" aria-hidden />
								) : null}
								Post
							</Button>
						</DetailMotionButtonWrap>
					) : (
						<Button
							type="submit"
							variant="accent"
							size="pill"
							disabled={busy || !body.trim()}
						>
							Post
						</Button>
					)}
				</div>
			</form>
			<ul className="space-y-3">
				{roots.map((row) => (
					<CommentThreadBranch
						key={row.comment.id}
						row={row}
						replyTo={null}
						childrenByParentId={childrenByParentId}
						appearance={appearance}
						listingContext={listingContext}
						viewerUserId={viewerUserId}
						editingCommentId={editingCommentId}
						editDraft={editDraft}
						editBusy={editBusy}
						onReply={startReply}
						onReactionChange={updateCommentReaction}
						onStartEdit={startEdit}
						onCancelEdit={cancelEdit}
						onEditDraftChange={setEditDraft}
						onSaveEdit={(commentId) => void saveEdit(commentId)}
						onRequestDelete={requestDelete}
					/>
				))}
				{comments.length === 0 ? (
					<li
						className={cn(
							"text-muted-foreground text-sm",
							isSheet && "w-full text-center",
						)}
					>
						No comments yet.
					</li>
				) : null}
			</ul>
			<div ref={listEndRef} aria-hidden className="h-0" />
			<CommentDeleteConfirmDialog
				open={deleteTargetId != null}
				deleting={deleteBusy}
				onCancel={() => setDeleteTargetId(null)}
				onConfirm={() => void confirmDelete()}
			/>
		</div>
	);
}
