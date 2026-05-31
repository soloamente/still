"use client";

import IconHeart from "@still/ui/icons/heart";
import IconHeartFilled from "@still/ui/icons/heart-filled";
import { cn } from "@still/ui/lib/utils";
import { Heart } from "lucide-react";
import { useState } from "react";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

type Kind = "review" | "list" | "post";

type ReactionsBarProps = {
	targetKind: Kind;
	targetId: string;
	initialLikes: number;
	initialLiked?: boolean;
	/** `sheet` — circular canvas button like quick-log favorite; `default` — inline text control. */
	appearance?: "default" | "sheet";
};

/**
 * Like toggle + counter. `appearance="sheet"` uses the quick-log favorite control
 * (circular `bg-background` button, filled heart when active).
 */
export function ReactionsBar({
	targetKind,
	targetId,
	initialLikes,
	initialLiked = false,
	appearance = "default",
}: ReactionsBarProps) {
	const [likes, setLikes] = useState(initialLikes);
	const [liked, setLiked] = useState(initialLiked);
	const [busy, setBusy] = useState(false);

	async function toggle() {
		setBusy(true);
		try {
			const route =
				targetKind === "review"
					? api.api.reviews({ id: targetId }).like
					: targetKind === "list"
						? api.api.lists({ id: targetId }).like
						: api.api.posts({ id: targetId }).like;
			const res = await route.post({});
			const data = res.data as { liked?: boolean } | null;
			const nowLiked = Boolean(data?.liked);
			setLiked(nowLiked);
			setLikes((n) => Math.max(0, n + (nowLiked ? 1 : -1)));
		} catch (err) {
			console.error(err);
		} finally {
			setBusy(false);
		}
	}

	if (appearance === "sheet") {
		return (
			<div className="flex flex-col items-center gap-2">
				<DetailMotionButton
					type="button"
					disabled={busy}
					className={cn(
						"inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-background transition-colors duration-200 ease-out motion-reduce:transition-none",
						!liked && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						liked && "bg-foreground text-background",
					)}
					aria-pressed={liked}
					aria-label={
						targetKind === "list"
							? liked
								? "Unlike list"
								: "Like list"
							: liked
								? "Unlike review"
								: "Like review"
					}
					onClick={() => void toggle()}
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
			onClick={() => void toggle()}
			disabled={busy}
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
