"use client";

import { Button } from "@still/ui/components/button";
import IconHeart from "@still/ui/icons/heart";
import IconHeartFilled from "@still/ui/icons/heart-filled";
import { cn } from "@still/ui/lib/utils";
import { Heart, ThumbsDown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DetailIconTooltip } from "@/components/movie/detail-icon-tooltip";
import {
	DetailMotionButton,
	DetailMotionButtonWrap,
} from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

type Kind = "review" | "list" | "post";

export type ReviewReactionSnapshot = {
	liked: boolean;
	likes: number;
	disliked: boolean;
	dislikes: number;
};

type ReactionsBarProps = {
	targetKind: Kind;
	targetId: string;
	initialLikes: number;
	initialLiked?: boolean;
	initialDislikes?: number;
	initialDisliked?: boolean;
	/** `sheet` — stacked circle + count; `header` — handle-row icon like edit/pin. */
	appearance?: "default" | "sheet" | "header";
	iconButtonClassName?: string;
	onReactionChange?: (state: ReviewReactionSnapshot) => void;
};

type ApiReviewReactionSnapshot = {
	liked?: boolean;
	disliked?: boolean;
	likesCount?: number;
	dislikesCount?: number;
};

function parseReviewReactionSnapshot(
	data: ApiReviewReactionSnapshot | null,
	fallback: ReviewReactionSnapshot,
): ReviewReactionSnapshot {
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

/**
 * Like toggle + counter. Reviews in `header` also expose dislike (mutually exclusive).
 */
export function ReactionsBar({
	targetKind,
	targetId,
	initialLikes,
	initialLiked = false,
	initialDislikes = 0,
	initialDisliked = false,
	appearance = "default",
	iconButtonClassName,
	onReactionChange,
}: ReactionsBarProps) {
	const [likes, setLikes] = useState(initialLikes);
	const [liked, setLiked] = useState(initialLiked);
	const [dislikes, setDislikes] = useState(initialDislikes);
	const [disliked, setDisliked] = useState(initialDisliked);
	const [likeBusy, setLikeBusy] = useState(false);
	const [dislikeBusy, setDislikeBusy] = useState(false);
	const { data: session } = authClient.useSession();
	const isReview = targetKind === "review";

	// Drawer remounts / refetch can arrive after first paint — follow server props.
	useEffect(() => {
		setLikes(initialLikes);
		setLiked(initialLiked);
		setDislikes(initialDislikes);
		setDisliked(initialDisliked);
	}, [initialDislikes, initialDisliked, initialLiked, initialLikes]);

	function publish(state: ReviewReactionSnapshot) {
		setLiked(state.liked);
		setLikes(state.likes);
		setDisliked(state.disliked);
		setDislikes(state.dislikes);
		onReactionChange?.(state);
	}

	function requireSignedIn(): boolean {
		if (session?.user) return true;
		toast.error("Sign in to react to reviews");
		return false;
	}

	async function toggleLike() {
		if (!requireSignedIn()) return;
		setLikeBusy(true);
		try {
			const route =
				targetKind === "review"
					? api.api.reviews({ id: targetId }).like
					: targetKind === "list"
						? api.api.lists({ id: targetId }).like
						: api.api.posts({ id: targetId }).like;
			const res = await route.post({});
			const data = res.data as
				| ApiReviewReactionSnapshot
				| { liked?: boolean }
				| null;

			if (isReview) {
				publish(
					parseReviewReactionSnapshot(data as ApiReviewReactionSnapshot, {
						liked,
						likes,
						disliked,
						dislikes,
					}),
				);
				return;
			}

			const nowLiked = Boolean((data as { liked?: boolean } | null)?.liked);
			const nextLikes = Math.max(0, likes + (nowLiked ? 1 : -1));
			publish({
				liked: nowLiked,
				likes: nextLikes,
				disliked: false,
				dislikes: 0,
			});
		} catch (err) {
			console.error(err);
			toast.error("Couldn't update like");
		} finally {
			setLikeBusy(false);
		}
	}

	async function toggleDislike() {
		if (!isReview) return;
		if (!requireSignedIn()) return;
		setDislikeBusy(true);
		try {
			const res = await api.api.reviews({ id: targetId }).dislike.post({});
			const data = res.data as ApiReviewReactionSnapshot | null;
			publish(
				parseReviewReactionSnapshot(data, {
					liked,
					likes,
					disliked,
					dislikes,
				}),
			);
		} catch (err) {
			console.error(err);
			toast.error("Couldn't update dislike");
		} finally {
			setDislikeBusy(false);
		}
	}

	const likeLabel =
		targetKind === "list"
			? liked
				? "Unlike list"
				: "Like list"
			: liked
				? "Unlike review"
				: "Like review";
	const dislikeLabel = disliked ? "Remove dislike" : "Dislike review";

	const headerReactionPillClass = cn(
		iconButtonClassName,
		"!size-auto min-h-12 min-w-12 gap-1.5 px-3",
	);

	if (appearance === "header") {
		const likesLabel = `${likes} ${likes === 1 ? "like" : "likes"}`;
		const dislikesLabel = `${dislikes} ${dislikes === 1 ? "dislike" : "dislikes"}`;

		return (
			<div className="flex items-center gap-1.5">
				<DetailMotionButtonWrap>
					<DetailIconTooltip label={likeLabel}>
						<Button
							type="button"
							variant="ghost"
							size="icon-pill"
							disabled={likeBusy || dislikeBusy}
							className={cn(
								headerReactionPillClass,
								liked
									? "bg-foreground text-background [@media(hover:hover)]:hover:bg-foreground/90"
									: DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
							)}
							aria-pressed={liked}
							aria-label={`${likeLabel}. ${likesLabel}.`}
							onClick={() => void toggleLike()}
						>
							{liked ? (
								<IconHeartFilled
									size="20px"
									className="shrink-0 opacity-90"
									aria-hidden
								/>
							) : (
								<IconHeart
									size="20px"
									className="shrink-0 opacity-90"
									aria-hidden
								/>
							)}
							<span className="font-medium text-sm tabular-nums">{likes}</span>
						</Button>
					</DetailIconTooltip>
				</DetailMotionButtonWrap>
				{isReview ? (
					<DetailMotionButtonWrap>
						<DetailIconTooltip label={dislikeLabel}>
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								disabled={likeBusy || dislikeBusy}
								className={cn(
									headerReactionPillClass,
									disliked
										? "bg-foreground text-background [@media(hover:hover)]:hover:bg-foreground/90"
										: DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								)}
								aria-pressed={disliked}
								aria-label={`${dislikeLabel}. ${dislikesLabel}.`}
								onClick={() => void toggleDislike()}
							>
								<ThumbsDown
									className={cn(
										"size-5 shrink-0 opacity-90",
										disliked && "fill-current",
									)}
									aria-hidden
								/>
								<span className="font-medium text-sm tabular-nums">
									{dislikes}
								</span>
							</Button>
						</DetailIconTooltip>
					</DetailMotionButtonWrap>
				) : null}
			</div>
		);
	}

	if (appearance === "sheet") {
		return (
			<div className="flex flex-col items-center gap-2">
				<DetailMotionButton
					type="button"
					disabled={likeBusy}
					className={cn(
						"inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-background transition-colors duration-200 ease-out motion-reduce:transition-none",
						!liked && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						liked && "bg-foreground text-background",
					)}
					aria-pressed={liked}
					aria-label={likeLabel}
					onClick={() => void toggleLike()}
				>
					{liked ? (
						<IconHeartFilled className="size-5" aria-hidden />
					) : (
						<IconHeart className="size-5" aria-hidden />
					)}
				</DetailMotionButton>
				<p className="text-muted-foreground text-xs tabular-nums">
					{likes} {likes === 1 ? "like" : "likes"}
				</p>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={() => void toggleLike()}
			disabled={likeBusy}
			className="inline-flex items-center gap-1 text-sm transition-colors hover:text-desert-orange"
		>
			<Heart
				className={
					liked
						? "size-3.5 fill-desert-orange text-desert-orange"
						: "size-3.5 text-current"
				}
			/>
			{likes}
		</button>
	);
}
