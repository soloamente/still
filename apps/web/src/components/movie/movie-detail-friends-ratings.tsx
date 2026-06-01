import { Heart } from "lucide-react";
import Link from "next/link";

import { formatStoredLogRatingDisplay } from "@/lib/log-rating";

export type FriendRatingChip = {
	userId: string;
	handle: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	rating: number | null;
	liked: boolean;
};

export type FriendsRatingsData = {
	rows: FriendRatingChip[];
	total: number;
};

function initial(chip: FriendRatingChip): string {
	const source = chip.displayName ?? chip.handle ?? "?";
	return source.trim().charAt(0).toUpperCase() || "?";
}

/**
 * "From friends" — compact avatar row of mutual-follow friends who rated this
 * title. Renders nothing when the viewer has no friend with a qualifying log.
 */
export function MovieDetailFriendsRatings({ rows, total }: FriendsRatingsData) {
	if (rows.length === 0) return null;
	const overflow = Math.max(0, total - rows.length);

	return (
		<section aria-label="Ratings from friends">
			<div className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-[0.06em]">
				From friends
			</div>
			<ul className="flex flex-wrap gap-x-4 gap-y-3">
				{rows.map((chip) => {
					const ratingText = formatStoredLogRatingDisplay(chip.rating);
					const body = (
						<>
							{chip.avatarUrl ? (
								// biome-ignore lint/performance/noImgElement: small avatars from mixed remote hosts; next/image optimizer not worth it here.
								<img
									src={chip.avatarUrl}
									alt=""
									className="size-11 rounded-full object-cover"
								/>
							) : (
								<span className="flex size-11 items-center justify-center rounded-full bg-muted/40 font-medium text-foreground/80 text-sm">
									{initial(chip)}
								</span>
							)}
							<span className="font-semibold text-foreground text-xs tabular-nums">
								{ratingText != null ? (
									<>★ {ratingText}</>
								) : (
									<Heart
										className="inline size-3.5 fill-desert-orange text-desert-orange"
										aria-label="liked"
									/>
								)}
							</span>
							<span className="max-w-[4.5rem] truncate text-[11px] text-muted-foreground">
								{chip.handle ? `@${chip.handle}` : chip.displayName}
							</span>
						</>
					);
					return (
						<li key={chip.userId}>
							{chip.handle ? (
								<Link
									href={`/profile/${chip.handle}`}
									className="flex w-16 flex-col items-center gap-1 text-center"
								>
									{body}
								</Link>
							) : (
								<span className="flex w-16 flex-col items-center gap-1 text-center">
									{body}
								</span>
							)}
						</li>
					);
				})}
				{overflow > 0 ? (
					<li className="flex w-16 flex-col items-center justify-center gap-1 text-center">
						<span className="flex size-11 items-center justify-center rounded-full bg-muted/30 text-muted-foreground text-xs">
							+{overflow}
						</span>
						<span className="text-[11px] text-muted-foreground">more</span>
					</li>
				) : null}
			</ul>
		</section>
	);
}
