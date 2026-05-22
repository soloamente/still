"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
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
 * Scrollable film + TV catalogue for one person — global Vaul sheet and nested cast sheet.
 */
export function PersonFilmographyPanel({
	seed,
	active,
	nested = false,
}: {
	seed: PersonFilmographySeed;
	active: boolean;
	nested?: boolean;
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
		<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
			<DetailDrawerScrollBody scrollRef={scrollRef} nested={nested}>
				<div className="mx-auto w-full max-w-4xl">
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
						{knownFor ||
						seed.roleHint ||
						(!loading && !error && titleCount > 0) ? (
							<div className="mt-2 flex flex-col gap-1">
								{knownFor ? (
									<p className="text-muted-foreground text-xs uppercase tracking-wider">
										{knownFor}
									</p>
								) : null}
								{seed.roleHint ? (
									<p className="text-balance font-editorial text-muted-foreground text-sm leading-snug">
										{seed.roleHint}
									</p>
								) : null}
								{!loading && !error && titleCount > 0 ? (
									<p className="text-muted-foreground text-sm leading-snug">
										{titleCount} title{titleCount === 1 ? "" : "s"} in film
										&amp; TV
									</p>
								) : null}
							</div>
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
						<PersonFilmographyGrid rows={filmography} />
					) : null}
				</div>
			</DetailDrawerScrollBody>
			<SheetScrollScrims
				showHeaderFade={showHeaderFade}
				showFooterFade={showFooterFade}
				footerTone="filmography"
			/>
		</div>
	);
}
