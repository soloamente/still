"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import type { CuratorSpotlightPatron } from "@/lib/creator-recognition";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

/**
 * Community lists tab — surfaces patrons earning curator recognition (SN.11).
 */
export function HomeCuratorSpotlights({
	patrons,
	className,
}: {
	patrons: CuratorSpotlightPatron[];
	className?: string;
}) {
	if (patrons.length === 0) return null;

	return (
		<section
			className={cn("mx-auto mb-6 w-full max-w-2xl px-1", className)}
			aria-label="Curators on Sense"
		>
			<p className="mb-3 text-center font-medium text-foreground text-sm">
				Curators on Sense
			</p>
			{/* Center when few patrons; scroll when the row overflows. */}
			<div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				<div className="flex min-w-full justify-center">
					<ul className="flex w-max gap-2">
						{patrons.map((patron) => (
							<li key={patron.userId} className="shrink-0">
								<Link
									href={`/profile/${patron.handle}`}
									className="flex w-[9.5rem] flex-col items-center rounded-2xl bg-background px-3 py-3 text-center transition-colors [@media(hover:hover)]:hover:bg-background/80"
								>
									<PatronPortraitWithMetalTier
										handle={patron.handle}
										avatarUrl={patron.image}
										name={patron.displayName}
										width={56}
										height={56}
										className="size-14 rounded-full"
										isAnimated={inferAnimatedFromProfileUrl(
											patron.image,
											patron.avatarIsAnimated,
										)}
										diaryMetalTier={patron.diaryMetalTier}
									/>
									<p className="mt-2 line-clamp-1 w-full font-medium text-foreground text-sm leading-snug">
										{patron.displayName}
									</p>
									<p className="line-clamp-1 w-full text-muted-foreground text-xs">
										@{patron.handle}
									</p>
									<p className="mt-1.5 line-clamp-2 text-balance font-editorial text-[11px] text-muted-foreground leading-relaxed">
										{patron.headline}
									</p>
								</Link>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
