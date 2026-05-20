"use client";

import { cn } from "@still/ui/lib/utils";
import { useRef, useState } from "react";
import { Drawer } from "vaul";

import {
	type CreditsCastMember,
	CreditsCatalog,
} from "@/components/movie/credits-catalog";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";

import { PersonFilmographyPanel } from "@/components/movie/person-filmography-panel";

import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import type { CrewRow } from "@/lib/movie-detail-tmdb";
import type { PersonFilmographySeed } from "@/lib/person-filmography";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/**

 * Vaul bottom drawer — full cast & crew catalog. Person taps open a nested drawer

 * with their full film + TV catalogue (no route change).

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

	return (
		<Drawer.Root
			open={catalogOpen}
			onOpenChange={(open) => {
				setCatalogOpen(open);

				if (!open) setPersonSeed(null);
			}}
			shouldScaleBackground={false}
		>
			<Drawer.Trigger asChild>
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
			</Drawer.Trigger>

			<Drawer.Portal>
				<Drawer.Overlay className="fixed inset-0 z-50 bg-absolute-black/82 backdrop-blur-sm" />

				<Drawer.Content
					className={cn(
						"fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[min(96svh,920px)] flex-col rounded-t-[2rem] bg-card outline-none",

						"shadow-2xl",
					)}
				>
					<Drawer.Handle className="mx-auto mt-3 mb-2 h-1 w-12 shrink-0 rounded-full bg-muted-foreground/35" />

					<Drawer.Title className="sr-only">
						Cast and crew — {title}
					</Drawer.Title>

					<Drawer.Description className="sr-only">
						Full cast and crew list for {title}.
					</Drawer.Description>

					<div className="relative min-h-0 flex-1">
						<div
							ref={scrollRef}
							className="max-h-[min(calc(96svh-6rem),820px)] overflow-y-auto overscroll-contain px-5 pt-2 pb-10 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-8 sm:pb-12 [&::-webkit-scrollbar]:hidden"
						>
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

						<SheetScrollScrims
							showHeaderFade={showHeaderFade}
							showFooterFade={showFooterFade}
						/>
					</div>

					<Drawer.NestedRoot
						open={personSeed != null}
						onOpenChange={(open) => {
							if (!open) setPersonSeed(null);
						}}
					>
						<Drawer.Portal>
							<Drawer.Overlay className="fixed inset-0 z-[60] bg-absolute-black/50" />

							<Drawer.Content
								className={cn(
									"fixed inset-x-0 bottom-0 z-[60] mt-24 flex max-h-[min(92svh,880px)] flex-col rounded-t-[2rem] bg-card outline-none",

									"shadow-2xl",
								)}
							>
								<Drawer.Handle className="mx-auto mt-3 mb-2 h-1 w-12 shrink-0 rounded-full bg-muted-foreground/35" />

								{personSeed ? (
									<>
										<Drawer.Title className="sr-only">
											{personSeed.name} — filmography
										</Drawer.Title>

										<Drawer.Description className="sr-only">
											Films and TV shows featuring {personSeed.name}.
										</Drawer.Description>

										<PersonFilmographyPanel
											seed={personSeed}
											active={personSeed != null}
											compact
										/>
									</>
								) : null}
							</Drawer.Content>
						</Drawer.Portal>
					</Drawer.NestedRoot>

					<Drawer.Close className="sr-only">Close cast and crew</Drawer.Close>
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	);
}
