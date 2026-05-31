"use client";

import Link from "next/link";

import { ReactionsBar } from "@/components/social/reactions-bar";

/**
 * Public list hero — like toggle (signed-in visitors) or read-only count.
 */
export function ListDetailLikeSection({
	listId,
	likesCount,
	initialLiked,
	canInteract,
	showSignInHint = false,
}: {
	listId: string;
	likesCount: number;
	initialLiked: boolean;
	/** Signed-in patron who is not the list owner. */
	canInteract: boolean;
	showSignInHint?: boolean;
}) {
	if (canInteract) {
		return (
			<div className="mt-6 flex w-full justify-center">
				<ReactionsBar
					appearance="sheet"
					targetKind="list"
					targetId={listId}
					initialLikes={likesCount}
					initialLiked={initialLiked}
				/>
			</div>
		);
	}

	return (
		<div className="mt-6 flex flex-col items-center gap-2">
			<p className="text-muted-foreground text-xs tabular-nums">
				{likesCount} {likesCount === 1 ? "like" : "likes"}
			</p>
			{showSignInHint ? (
				<p className="max-w-xs text-balance text-center text-muted-foreground text-xs leading-relaxed">
					<Link
						href="/sign-in"
						className="font-medium text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
					>
						Sign in
					</Link>{" "}
					to like this list
				</p>
			) : null}
		</div>
	);
}
