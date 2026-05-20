import { cn } from "@still/ui/lib/utils";
import { Award } from "lucide-react";
import Image from "next/image";

import { isBadgeArtworkUrl } from "@/lib/badge-artwork";

type EarnedBadge = {
	badge: {
		id: string;
		slug: string;
		name: string;
		description: string | null;
		iconUrl: string | null;
		tier: string;
	};
	userBadge: { awardedAt: string };
};

/**
 * Round-pill badge tiles arranged in a responsive grid. Tier maps to
 * Aker's accent palette so bronze < silver < gold feel different at a
 * glance without leaning on color alone.
 */
export function BadgeShelf({ badges }: { badges: EarnedBadge[] }) {
	if (badges.length === 0) {
		return (
			<p className="rounded-2xl border border-border border-dashed bg-card/40 p-10 text-center text-muted-foreground text-sm">
				No badges yet. Log your first film to start collecting.
			</p>
		);
	}
	return (
		<ul className="grid grid-cols-3 gap-3 md:grid-cols-5">
			{badges.map(({ badge }) => (
				<li
					key={badge.id}
					className={cn(
						"flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 p-4 text-center",
						badge.tier === "gold" &&
							"border-desert-orange/40 bg-desert-orange/5",
					)}
				>
					{badge.iconUrl && isBadgeArtworkUrl(badge.iconUrl) ? (
						<span className="relative flex h-16 w-14 shrink-0 items-center justify-center overflow-visible pt-1">
							<Image
								src={badge.iconUrl}
								alt=""
								width={56}
								height={64}
								unoptimized
								className="max-h-full max-w-full object-contain"
							/>
						</span>
					) : (
						<span
							className={cn(
								"grid size-14 place-items-center rounded-[var(--radius-badge)] border border-border bg-soft-stone text-pure-white",
								badge.tier === "gold" &&
									"border-desert-orange bg-desert-orange text-absolute-black",
								badge.tier === "silver" &&
									"bg-slate-border text-absolute-black",
								badge.tier === "bronze" && "bg-copper-clay text-pure-white",
							)}
						>
							{badge.iconUrl ? (
								<Image
									src={badge.iconUrl}
									alt=""
									width={28}
									height={28}
									unoptimized
									className="size-7 object-contain"
								/>
							) : (
								<Award className="size-6" aria-hidden />
							)}
						</span>
					)}
					<p className="font-medium font-serif text-sm">{badge.name}</p>
					{badge.description ? (
						<p className="text-muted-foreground text-xs">{badge.description}</p>
					) : null}
				</li>
			))}
		</ul>
	);
}
