"use client";

import { ReviewSpoilerPreview } from "@/components/review/review-spoiler-preview";

/** Spoiler-masked title + body block for Community Activity review rows. */
export function ReviewActivityCopy({
	containsSpoilers,
	movieId,
	reviewUserId,
	title,
	body,
}: {
	containsSpoilers: boolean;
	movieId?: number | null;
	reviewUserId: string;
	title: string | null;
	body: string;
}) {
	const hasCopy = Boolean(title?.trim() || body.trim());
	if (!hasCopy) return null;

	return (
		<ReviewSpoilerPreview
			containsSpoilers={containsSpoilers}
			movieId={movieId}
			reviewUserId={reviewUserId}
			align="start"
		>
			{title ? (
				<p className="text-balance font-serif text-base text-foreground/90 leading-snug">
					{title}
				</p>
			) : null}
			<p className="line-clamp-2 text-pretty text-foreground/75 text-sm leading-relaxed">
				{body}
			</p>
		</ReviewSpoilerPreview>
	);
}
