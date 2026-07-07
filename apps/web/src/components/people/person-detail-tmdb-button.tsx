import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { ArrowUpRight } from "lucide-react";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

/** Outbound CTA on the person About tab — opens the TMDb profile in a new tab. */
export function PersonDetailTmdbButton({ personId }: { personId: number }) {
	return (
		<div className="flex justify-center py-4">
			<a
				href={`https://www.themoviedb.org/person/${personId}`}
				target="_blank"
				rel="noopener noreferrer"
				className={cn(
					buttonVariants({ variant: "secondary", size: "pill-lg" }),
					"h-auto min-h-12 rounded-full bg-background py-3.5",
					DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
				)}
			>
				View more on TMDb
				<ArrowUpRight className="size-4 opacity-80" aria-hidden />
			</a>
		</div>
	);
}
