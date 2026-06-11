"use client";

import { cn } from "@still/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { openPersonFilmography } from "@/components/movie/person-filmography-drawer";
import {
	type ArcCreditCard,
	arcRowVisualForSlot,
	CAST_CREW_ARC_MOBILE_CURVE_SCALE,
	CAST_CREW_ARC_MOBILE_SLOT_COUNT,
	CAST_CREW_ARC_SLOT_COUNT,
	sliceArcCenterCards,
} from "@/lib/movie-cast-crew-arc";
import { useCastCrewMonochromeOnHover } from "@/lib/use-cast-crew-monochrome-pref";

function resolveArcSlotLimit(matchesSm: boolean): number {
	return matchesSm ? CAST_CREW_ARC_SLOT_COUNT : CAST_CREW_ARC_MOBILE_SLOT_COUNT;
}

/** Match Tailwind `sm` — fewer arc slots below this width. */
function useCastCrewArcSlotLimit(): number {
	const [limit, setLimit] = useState(CAST_CREW_ARC_MOBILE_SLOT_COUNT);

	useEffect(() => {
		const mq = window.matchMedia("(min-width: 640px)");
		const sync = () => setLimit(resolveArcSlotLimit(mq.matches));
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);

	return limit;
}

/** Client-only arc row — portrait taps open the filmography drawer. */
export function MovieCastCrewArcRow({
	cards,
	row,
}: {
	cards: ArcCreditCard[];
	row: "cast" | "crew";
}) {
	const monochromeOnHover = useCastCrewMonochromeOnHover();
	const slotLimit = useCastCrewArcSlotLimit();
	const visibleCards = useMemo(
		() => sliceArcCenterCards(cards, slotLimit),
		[cards, slotLimit],
	);
	const arcCurveScale =
		slotLimit < CAST_CREW_ARC_SLOT_COUNT ? CAST_CREW_ARC_MOBILE_CURVE_SCALE : 1;

	return (
		<ul
			className={cn(
				"flex w-full justify-center gap-1.5 px-2 sm:gap-1 sm:px-3 lg:gap-1.5 lg:px-4",
				row === "cast"
					? "items-start pb-[var(--cast-crew-arc-edge)]"
					: "items-end pt-[var(--cast-crew-arc-edge)]",
			)}
			aria-label={row === "cast" ? "Featured cast" : "Featured crew"}
		>
			{visibleCards.map((person, slotIndex) => (
				<MovieCastCrewArcCard
					key={`${row}-${person.id}-${person.subtitle ?? ""}`}
					person={person}
					slotIndex={slotIndex}
					slotCount={visibleCards.length}
					row={row}
					arcCurveScale={arcCurveScale}
					monochromeOnHover={monochromeOnHover}
				/>
			))}
		</ul>
	);
}

function MovieCastCrewArcCard({
	person,
	slotIndex,
	slotCount,
	row,
	arcCurveScale,
	monochromeOnHover,
}: {
	person: ArcCreditCard;
	slotIndex: number;
	slotCount: number;
	row: "cast" | "crew";
	arcCurveScale: number;
	monochromeOnHover: boolean;
}) {
	const { translateY } = arcRowVisualForSlot(slotIndex, slotCount, row);
	const scaledTranslateY = translateY * arcCurveScale;

	return (
		<li
			className="relative flex w-[clamp(4.25rem,17vw,5.75rem)] shrink-0 justify-center sm:w-[clamp(3.75rem,6.8vw,7.25rem)] lg:w-[clamp(4.25rem,7.2vw,8.5rem)] xl:w-[clamp(4.5rem,7.8vw,9.25rem)] 2xl:w-[clamp(5rem,8.2vw,9.75rem)]"
			style={{
				transform:
					scaledTranslateY !== 0
						? `translateY(${scaledTranslateY}px)`
						: undefined,
			}}
		>
			<button
				type="button"
				className="group block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				aria-label={`${person.name}${person.subtitle ? `, ${person.subtitle}` : ""}`}
				onClick={() =>
					openPersonFilmography({
						personId: person.id,
						name: person.name,
						profilePath: person.profilePath,
						roleHint: person.subtitle ?? undefined,
					})
				}
			>
				<div className="relative aspect-3/4 overflow-hidden rounded-[1.5rem] bg-muted/35 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.65)] sm:rounded-[1.85rem] lg:rounded-[2rem] xl:rounded-[2.15rem]">
					<PersonCreditPortrait
						name={person.name}
						profilePath={person.profilePath}
						grayscale={monochromeOnHover}
						sizes="(max-width: 640px) 104px, (max-width: 1280px) 140px, 168px"
						imageClassName="transition-[filter] duration-200 ease-out"
					/>
					<div
						className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/45 to-transparent px-2 pt-8 pb-2"
						aria-hidden
					/>
					<div className="pointer-events-none absolute inset-x-0 bottom-0 px-2 pb-2 text-center">
						<p className="line-clamp-1 font-semibold text-[11px] text-white leading-tight sm:text-xs">
							{person.name}
						</p>
						{person.subtitle ? (
							<p className="mt-0.5 line-clamp-1 text-[10px] text-white/65 leading-tight sm:text-[11px]">
								{person.subtitle}
							</p>
						) : null}
					</div>
				</div>
			</button>
		</li>
	);
}
