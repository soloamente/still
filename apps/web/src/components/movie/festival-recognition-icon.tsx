import IconAcademyAwards from "@still/ui/icons/academy-awards";
import IconBafta from "@still/ui/icons/bafta";
import IconBeyondFestival from "@still/ui/icons/beyond-festival";
import IconBfi from "@still/ui/icons/bfi";
import IconBusanFestival from "@still/ui/icons/busan-festival";
import IconCannesFestival from "@still/ui/icons/cannes-festival";
import IconLocarnoFestival from "@still/ui/icons/locarno-festival";
import IconMillValleyFestival from "@still/ui/icons/mill-valley-festival";
import IconMtv from "@still/ui/icons/mtv";
import IconTellurideFestival from "@still/ui/icons/telluride-festival";
import IconTiffFestival from "@still/ui/icons/tiff-festival";
import IconVeniceFestival from "@still/ui/icons/venice-festival";
import IconZurichFestival from "@still/ui/icons/zurich-festival";
import { cn } from "@still/ui/lib/utils";
import { Award, Clapperboard } from "lucide-react";
import type { ReactNode } from "react";

import type { FestivalIconId } from "@/lib/movie-festival-recognition";

/**
 * Shared footprint for every festival mark — wide wordmarks and tall emblems
 * scale inside the same box (like object-contain) so the row feels even.
 */
const BRAND_MARK_SLOT =
	"relative flex h-11 w-[7.25rem] shrink-0 items-center justify-center overflow-visible text-foreground/85 sm:h-12 sm:w-32";

/**
 * Cap every mark to the same visual height (wide OSCARS / TIFF no longer
 * blow out the slot; tall BAFTA does not dominate).
 */
const BRAND_MARK_SVG =
	"block h-auto w-auto max-h-9 max-w-full overflow-visible sm:max-h-10";

function BrandMarkSlot({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return <span className={cn(BRAND_MARK_SLOT, className)}>{children}</span>;
}

/**
 * Monochrome festival / award marks — MUBI-style row with uniform logo slots.
 */
export function FestivalRecognitionIcon({
	icon,
	className,
}: {
	icon: FestivalIconId;
	className?: string;
}) {
	const slot = cn(BRAND_MARK_SLOT, className);

	switch (icon) {
		case "cannes":
			return (
				<BrandMarkSlot className={slot}>
					<IconCannesFestival aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "oscars":
			return (
				<BrandMarkSlot className={slot}>
					<IconAcademyAwards aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "bafta":
			return (
				<BrandMarkSlot className={slot}>
					<IconBafta aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "london":
			return (
				<BrandMarkSlot className={slot}>
					<IconBfi aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "tiff":
			return (
				<BrandMarkSlot className={slot}>
					<IconTiffFestival aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "telluride":
			return (
				<BrandMarkSlot className={slot}>
					<IconTellurideFestival aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "busan":
			return (
				<BrandMarkSlot className={slot}>
					<IconBusanFestival aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "beyond":
			return (
				<BrandMarkSlot className={slot}>
					<IconBeyondFestival aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "zurich":
			return (
				<BrandMarkSlot className={slot}>
					<IconZurichFestival aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "mill-valley":
			return (
				<BrandMarkSlot className={slot}>
					<IconMillValleyFestival aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "locarno":
			return (
				<BrandMarkSlot className={slot}>
					<IconLocarnoFestival aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "mtv":
			return (
				<BrandMarkSlot className={slot}>
					<IconMtv aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "berlinale":
			return (
				<BrandMarkSlot className={slot}>
					<svg
						aria-label="Berlin International Film Festival"
						viewBox="0 0 24 24"
						className={BRAND_MARK_SVG}
						fill="currentColor"
						aria-hidden
					>
						<path d="M7 6h10v3H7V6zm-1 5h12c0 4-2.5 7-6 7s-6-3-6-7zm1 2v1c0 2.2 1.6 4 5 4s5-1.8 5-4v-1H6z" />
					</svg>
				</BrandMarkSlot>
			);
		case "venice":
			return (
				<BrandMarkSlot className={slot}>
					<IconVeniceFestival aria-hidden className={BRAND_MARK_SVG} />
				</BrandMarkSlot>
			);
		case "sundance":
			return (
				<BrandMarkSlot
					className={cn(
						slot,
						"font-semibold text-[9px] uppercase tracking-wider sm:text-[10px]",
					)}
					aria-hidden
				>
					Sundance
				</BrandMarkSlot>
			);
		case "premiere":
			return (
				<BrandMarkSlot className={slot}>
					<Clapperboard
						className="size-8 max-h-full max-w-full sm:size-9"
						strokeWidth={1.75}
						aria-hidden
					/>
				</BrandMarkSlot>
			);
		case "award":
			return (
				<BrandMarkSlot className={slot}>
					<Award
						className="size-8 max-h-full max-w-full sm:size-9"
						strokeWidth={1.75}
						aria-hidden
					/>
				</BrandMarkSlot>
			);
		default:
			return (
				<BrandMarkSlot
					className={cn(
						slot,
						"font-semibold text-[10px] uppercase tracking-wider",
					)}
					aria-hidden
				>
					{icon.slice(0, 4)}
				</BrandMarkSlot>
			);
	}
}
