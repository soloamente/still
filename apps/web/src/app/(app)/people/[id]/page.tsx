import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { MovieDetailHeroSlide } from "@/components/movie/movie-detail-hero-media";
import { MovieDetailStillsSection } from "@/components/movie/movie-detail-stills-carousel";
import { PersonAwardsAsync } from "@/components/people/person-awards-async";
import { PersonDetailHero } from "@/components/people/person-detail-hero";
import { PersonDetailTmdbButton } from "@/components/people/person-detail-tmdb-button";
import { PersonDetailViewShell } from "@/components/people/person-detail-view-shell";
import { PersonFilmographyCatalogue } from "@/components/people/person-filmography-catalogue";
import { MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME } from "@/lib/movie-detail-sections";
import { buildPersonDetailInfoCards } from "@/lib/person-detail-facts";
import { parsePersonDetailViewFromSearchParams } from "@/lib/person-detail-view";
import type { PersonFilmographyRow } from "@/lib/person-filmography";
import { sortFilmographyByYearDesc } from "@/lib/person-filmography";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type PersonPayload = {
	code?: "TMDB_UNCONFIGURED";
	hint?: string;
	person: {
		id: number;
		name: string;
		biography: string;
		birthday: string | null;
		deathday: string | null;
		placeOfBirth: string | null;
		gender: number | null;
		knownForDepartment?: string;
		profilePath: string | null;
		profileUrl: string | null;
		/** IMDb nm… id when TMDb external_ids includes it (Wikidata awards lookup). */
		imdbId?: string | null;
	} | null;
	/** Tagged film/TV stills + extra headshots for the About gallery rail. */
	screenshots?: MovieDetailHeroSlide[];
	filmography: PersonFilmographyRow[];
};

type Params = { id: string };

export async function generateMetadata({
	params,
}: {
	params: Promise<Params>;
}): Promise<Metadata> {
	const { id } = await params;
	const numericId = Number(id);
	if (!Number.isFinite(numericId)) return { title: "Person" };

	const api = await serverApi();
	const res = await api.api
		.people({ id })
		.get()
		.catch(() => ({ data: null as PersonPayload | null }));
	const data = res.data as PersonPayload | null;
	const name = data?.person?.name;
	return { title: name ? `${name} · Filmography` : "Person" };
}

export default async function PersonPage({
	params,
	searchParams,
}: {
	params: Promise<Params>;
	searchParams: Promise<{ view?: string }>;
}) {
	const { id } = await params;
	const sp = await searchParams;
	const initialView = parsePersonDetailViewFromSearchParams(sp);
	const numericId = Number(id);
	if (!Number.isFinite(numericId)) notFound();

	const basePath = `/people/${id}`;

	const api = await serverApi();
	const res = await api.api
		.people({ id })
		.get()
		.catch(() => ({ data: null as PersonPayload | null }));
	const data = res.data as PersonPayload | null;

	if (!data) notFound();

	if (data.code === "TMDB_UNCONFIGURED") {
		return (
			<PersonDetailViewShell
				initialView="about"
				basePath={basePath}
				personId={numericId}
				title="Person"
				hero={null}
				about={
					<p className="mx-auto max-w-lg px-4 pt-8 pb-12 text-center text-muted-foreground text-sm">
						{data.hint}
					</p>
				}
				filmography={null}
			/>
		);
	}

	const person = data.person;
	if (!person) notFound();

	const infoCards = buildPersonDetailInfoCards({
		birthday: person.birthday,
		deathday: person.deathday,
		placeOfBirth: person.placeOfBirth,
		gender: person.gender,
		knownForDepartment: person.knownForDepartment,
	});

	const filmography = sortFilmographyByYearDesc(data.filmography);
	const screenshots = data.screenshots ?? [];

	return (
		<PersonDetailViewShell
			initialView={initialView}
			basePath={basePath}
			personId={person.id}
			title={person.name}
			hero={
				<PersonDetailHero
					name={person.name}
					knownForDepartment={person.knownForDepartment}
					profilePath={person.profilePath}
					profileUrl={person.profileUrl}
					biography={person.biography?.trim() ? person.biography.trim() : null}
					infoCards={infoCards}
				/>
			}
			about={
				<>
					<div className="mx-auto w-full max-w-lg px-2.5 pb-6 sm:px-3">
						<PersonDetailTmdbButton personId={person.id} />
					</div>
					{/* Same editorial stills chrome as movie/TV About — tagged film frames. */}
					{screenshots.length > 0 ? (
						<div className={MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME}>
							<MovieDetailStillsSection
								screenshots={screenshots}
								title={person.name}
								imageFit="contain"
							/>
						</div>
					) : null}
					{/* Wikidata awards stream after stills so the hero/shell paints first. */}
					<Suspense fallback={null}>
						<PersonAwardsAsync
							tmdbPersonId={person.id}
							imdbId={person.imdbId ?? null}
							personName={person.name}
						/>
					</Suspense>
				</>
			}
			filmography={<PersonFilmographyCatalogue rows={filmography} />}
		/>
	);
}
