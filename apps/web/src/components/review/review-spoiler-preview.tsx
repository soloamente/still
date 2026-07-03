"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { ReviewSpoilerGuard } from "@/components/review/review-spoiler-guard";
import { authClient } from "@/lib/auth-client";
import { useViewerHasWatchedMovie } from "@/lib/use-viewer-has-watched-movie";

/**
 * Feed/card preview wrapper — applies watched + own-review rules and local reveal
 * state before showing spoiler-tagged title/body copy.
 */
export function ReviewSpoilerPreview({
	containsSpoilers,
	movieId,
	reviewUserId,
	children,
	className,
	align = "start",
	/** When true, omit nested role=button (parent card is already a button). */
	nestedInInteractive = false,
}: {
	containsSpoilers: boolean;
	movieId?: number | null;
	reviewUserId?: string | null;
	children: ReactNode;
	className?: string;
	align?: "start" | "center";
	nestedInInteractive?: boolean;
}) {
	const { data: session } = authClient.useSession();
	const { hasWatched } = useViewerHasWatchedMovie(movieId);
	const [revealed, setRevealed] = useState(false);
	const isOwnReview =
		session?.user?.id != null &&
		reviewUserId != null &&
		reviewUserId === session.user.id;

	return (
		<ReviewSpoilerGuard
			containsSpoilers={containsSpoilers}
			hasWatchedMovie={hasWatched}
			isOwnReview={isOwnReview}
			revealed={revealed}
			onReveal={() => setRevealed(true)}
			className={className}
			align={align}
			nestedInInteractive={nestedInInteractive}
		>
			{children}
		</ReviewSpoilerGuard>
	);
}
