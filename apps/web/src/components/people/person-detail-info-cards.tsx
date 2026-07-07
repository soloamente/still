import { cn } from "@still/ui/lib/utils";

import type { PersonDetailInfoCard } from "@/lib/person-detail-facts";

/**
 * Raised fact tiles under the person name — DOB, age, birthplace, and other
 * TMDb metadata. Uses `bg-background` on the hero `bg-card` canvas (no borders).
 */
export function PersonDetailInfoCards({
	cards,
	className,
}: {
	cards: PersonDetailInfoCard[];
	className?: string;
}) {
	if (cards.length === 0) return null;

	return (
		<div className="mt-6 flex w-full justify-center">
			<div
				className={cn(
					"grid w-full max-w-md grid-cols-2 gap-2 sm:max-w-lg sm:gap-3",
					cards.length === 3 && "max-w-xl sm:grid-cols-3",
					cards.length >= 4 && "lg:max-w-2xl",
					className,
				)}
			>
				{cards.map((card) => (
					<div
						key={card.id}
						className="flex min-w-0 flex-col items-center rounded-2xl bg-background px-4 py-3 text-center"
					>
						<span className="text-muted-foreground text-xs leading-snug">
							{card.label}
						</span>
						<span className="mt-1 text-balance font-medium text-foreground text-sm leading-snug">
							{card.value}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
