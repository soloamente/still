import { cn } from "@still/ui/lib/utils";
import { Award } from "lucide-react";
import Image from "next/image";

import { isBadgeArtworkUrl } from "@/lib/badge-artwork";

/**
 * Regular heptagon clip (flat-top) — matches profile milestone tray silhouette.
 */
export const HEPTAGON_CLIP =
	"[clip-path:polygon(50%_0%,90%_19%,98%_59%,71%_97%,29%_97%,2%_59%,10%_19%)]";

/** Flat tier fills — no drop shadows (lobby surfaces use depth elsewhere). */
export function tierHeptagonClass(tier: string): string {
	switch (tier) {
		case "gold":
			return "border border-desert-orange/45 bg-gradient-to-br from-desert-orange to-amber-900/85 text-absolute-black";
		case "silver":
			return "border border-zinc-400/45 bg-gradient-to-br from-zinc-300 to-zinc-500 text-absolute-black";
		case "platinum":
			return "border border-slate-400/40 bg-gradient-to-br from-slate-200 to-slate-500 text-absolute-black";
		case "legendary":
			return "border border-amber-200/35 bg-gradient-to-br from-amber-200 via-amber-400 to-rose-900/85 text-absolute-black";
		default:
			return "border border-amber-900/55 bg-gradient-to-br from-amber-800 to-amber-950 text-pure-white";
	}
}

export const ACHIEVEMENT_HEPTAGON_CLASS =
	"border border-emerald-500/40 bg-gradient-to-br from-emerald-600 to-emerald-950 text-pure-white";

const HEPTAGON_GLYPH_CLASS =
	"grid size-17 shrink-0 place-items-center overflow-visible";

/** Taller frame for `/badges/*.png` medals — artwork extends above the label band. */
const BADGE_ARTWORK_GLYPH_CLASS =
	"relative flex h-[4.75rem] w-[4.25rem] shrink-0 items-center justify-center overflow-visible pt-1.5";

/** Full PNG artwork from `public/badges/` — no tier heptagon behind it. */
export function MilestoneBadgeGlyph({
	iconUrl,
	tier,
	name,
	locked = false,
}: {
	iconUrl: string | null;
	tier: string;
	name: string;
	/** Muted tray tile when the patron has not earned this badge yet. */
	locked?: boolean;
}) {
	if (iconUrl && isBadgeArtworkUrl(iconUrl)) {
		return (
			<div
				className={cn(
					BADGE_ARTWORK_GLYPH_CLASS,
					locked && "opacity-45 grayscale motion-reduce:transition-none",
				)}
			>
				<Image
					src={iconUrl}
					alt={name}
					width={68}
					height={80}
					unoptimized
					className="max-h-full max-w-full object-contain"
				/>
			</div>
		);
	}

	return (
		<div
			className={cn(
				HEPTAGON_GLYPH_CLASS,
				HEPTAGON_CLIP,
				tierHeptagonClass(tier),
				locked && "opacity-45 grayscale",
			)}
		>
			{iconUrl ? (
				<Image
					src={iconUrl}
					alt=""
					width={28}
					height={28}
					unoptimized
					className="size-7 object-contain opacity-95"
				/>
			) : (
				<Award className="size-7 opacity-95" strokeWidth={1.5} aria-hidden />
			)}
		</div>
	);
}
