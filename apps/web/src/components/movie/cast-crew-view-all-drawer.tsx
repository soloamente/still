"use client";

import { cn } from "@still/ui/lib/utils";
import { useRef, useState } from "react";
import {
	type CreditsCastMember,
	CreditsCatalog,
} from "@/components/movie/credits-catalog";
import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import {
	DetailVaulNestedSheet,
	DetailVaulSheet,
} from "@/components/movie/detail-vaul-sheet";
import { PersonFilmographyPanel } from "@/components/movie/person-filmography-panel";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import type { CrewRow } from "@/lib/movie-detail-tmdb";
import type { PersonFilmographySeed } from "@/lib/person-filmography";
import { useLockDrawerScroll } from "@/lib/use-lock-drawer-scroll";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/**
 * Cast & crew catalogue sheet. Person taps open a nested sheet with full filmography.
 */
export function CastCrewViewAllDrawer({
	title,
	cast,
	crewRows,
}: {
	title: string;
	cast: CreditsCastMember[];
	crewRows: CrewRow[];
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [catalogOpen, setCatalogOpen] = useState(false);
	const [personSeed, setPersonSeed] = useState<PersonFilmographySeed | null>(
		null,
	);

	const catalogKey = `${title}:${cast.length}:${crewRows.length}`;

	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		catalogOpen,
		catalogKey,
	);

	useLockDrawerScroll(catalogOpen || personSeed != null);

	return (
		<DetailVaulSheet
			open={catalogOpen}
			onOpenChange={(open) => {
				setCatalogOpen(open);
				if (!open) setPersonSeed(null);
			}}
			scrollLock={false}
			title={`Cast and crew — ${title}`}
			description={`Full cast and crew list for ${title}.`}
			trigger={
				<DetailMotionButton
					type="button"
					className={cn(
						"inline-flex items-center justify-center rounded-full bg-background px-5 py-2.5 font-medium text-foreground text-sm",
						"transition-colors duration-200 ease-out motion-reduce:transition-none",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					)}
				>
					View all
				</DetailMotionButton>
			}
		>
			<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
				<DetailDrawerScrollBody scrollRef={scrollRef}>
					<div className="mx-auto w-full max-w-4xl">
						<CreditsCatalog
							title={title}
							cast={cast}
							crewRows={crewRows}
							appearance="sheet"
							onPersonSelect={(credit) =>
								setPersonSeed({
									personId: credit.personId,
									name: credit.name,
									profilePath: credit.profilePath,
									roleHint: credit.roleHint,
								})
							}
						/>
					</div>
				</DetailDrawerScrollBody>

				<SheetScrollScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
					footerTone="filmography"
				/>
			</div>

			<DetailVaulNestedSheet
				open={personSeed != null}
				onOpenChange={(open) => {
					if (!open) setPersonSeed(null);
				}}
				title={personSeed ? `${personSeed.name} — filmography` : "Filmography"}
				description={
					personSeed
						? `Films and TV shows featuring ${personSeed.name}.`
						: undefined
				}
			>
				{personSeed ? (
					<PersonFilmographyPanel
						seed={personSeed}
						active={personSeed != null}
						nested
					/>
				) : null}
			</DetailVaulNestedSheet>
		</DetailVaulSheet>
	);
}
