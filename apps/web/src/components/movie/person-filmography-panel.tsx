"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { PersonFilmographyGrid } from "@/components/movie/person-filmography-grid";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import type {
	PersonFilmographyPayload,
	PersonFilmographySeed,
} from "@/lib/person-filmography";
import { fetchPersonFilmography } from "@/lib/still-api-fetch";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/**
 * Scrollable film + TV catalogue for one person — shared by the global Vaul host
 * and the nested drawer inside cast & crew “View all”.
 */
export function PersonFilmographyPanel({
	seed,
	active,
	compact = false,
}: {
	seed: PersonFilmographySeed;
	active: boolean;
	/** Nested drawer — slightly shorter scroll viewport. */
	compact?: boolean;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const contentKey = `${seed.personId}:${seed.roleHint ?? ""}`;
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		active,
		contentKey,
	);

	const [payload, setPayload] = useState<PersonFilmographyPayload | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!active) return;

		let cancelled = false;
		setLoading(true);
		setError(null);
		setPayload(null);

		void fetchPersonFilmography(seed.personId)
			.then((res) => {
				if (cancelled) return;
				const data = res.data as PersonFilmographyPayload | null;
				if (!data || res.error) {
					setError("Could not load filmography.");
					setPayload(null);
					return;
				}
				if (data.code === "TMDB_UNCONFIGURED") {
					setError(data.hint ?? "TMDb is not configured on the server.");
					setPayload(null);
					return;
				}
				setPayload(data);
			})
			.catch(() => {
				if (!cancelled) setError("Could not load filmography.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [active, seed.personId]);

	const person = payload?.person;
	const displayName = person?.name ?? seed.name;
	const knownFor = person?.knownForDepartment?.trim();
	const filmography = payload?.filmography ?? [];
	const titleCount = filmography.length;

	return (
		<div className="relative min-h-0 flex-1">
			<div
				ref={scrollRef}
				className={cn(
					"overflow-y-auto overscroll-contain px-5 pt-2 pb-10 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-8 sm:pb-12 [&::-webkit-scrollbar]:hidden",
					compact
						? "max-h-[min(calc(85svh-5rem),760px)]"
						: "max-h-[min(calc(96svh-6rem),820px)]",
				)}
			>
				<header className="mx-auto mb-8 max-w-md text-center">
					<div className="mx-auto mb-4 flex justify-center">
						<div className="relative aspect-[2/3] w-[5.5rem] overflow-hidden rounded-2xl bg-muted/30 shadow-lg sm:w-24">
							<PersonCreditPortrait
								name={displayName}
								profilePath={person?.profilePath ?? seed.profilePath}
								grayscale
								sizes="96px"
							/>
						</div>
					</div>
					<h2 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
						{displayName}
					</h2>
					{knownFor ? (
						<p className="mt-1 text-muted-foreground text-xs uppercase tracking-wider">
							{knownFor}
						</p>
					) : null}
					{seed.roleHint ? (
						<p className="mt-3 text-balance font-editorial text-muted-foreground text-sm leading-relaxed">
							{seed.roleHint}
						</p>
					) : null}
					{!loading && !error && titleCount > 0 ? (
						<p className="mt-3 text-muted-foreground text-sm">
							{titleCount} title{titleCount === 1 ? "" : "s"} in film &amp; TV
						</p>
					) : null}
				</header>

				{loading ? (
					<div
						className="flex justify-center py-16"
						role="status"
						aria-live="polite"
					>
						<Loader2 className="size-8 animate-spin text-muted-foreground" />
					</div>
				) : null}

				{error ? (
					<p
						className="rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
						role="alert"
					>
						{error}
					</p>
				) : null}

				{!loading && !error ? (
					<div className="mx-auto max-w-4xl">
						<PersonFilmographyGrid rows={filmography} />
					</div>
				) : null}
			</div>
			<SheetScrollScrims
				showHeaderFade={showHeaderFade}
				showFooterFade={showFooterFade}
			/>
		</div>
	);
}
