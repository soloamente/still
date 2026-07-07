"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

/** Top-right handle action — opens the full `/people/[id]` profile route. */
export function PersonFilmographyDrawerTrailing({
	personId,
	personName,
	onNavigate,
}: {
	personId: number;
	personName: string;
	onNavigate?: () => void;
}) {
	const openFullPageLabel = `Open full page for ${personName}`;

	return (
		<div className="flex shrink-0 items-center gap-1">
			<DetailMotionButtonWrap>
				<Button
					variant="ghost"
					size="pill"
					nativeButton={false}
					className={cn(
						"h-12 rounded-full bg-background px-4 text-muted-foreground",
						"max-sm:size-10 max-sm:justify-center max-sm:gap-0 max-sm:p-0",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					aria-label={openFullPageLabel}
					render={<Link href={`/people/${personId}`} />}
					onClick={onNavigate}
				>
					<span className="hidden font-medium text-foreground text-sm sm:inline">
						Open full page
					</span>
					<ArrowUpRight
						className="size-4 shrink-0 text-foreground opacity-90"
						aria-hidden
					/>
				</Button>
			</DetailMotionButtonWrap>
		</div>
	);
}
