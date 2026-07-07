import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { PersonFilmographyGrid } from "@/components/movie/person-filmography-grid";
import { PersonDetailHero } from "@/components/people/person-detail-hero";
import { PersonDetailTmdbButton } from "@/components/people/person-detail-tmdb-button";
import { PersonDetailViewShell } from "@/components/people/person-detail-view-shell";
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
	} | null;
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
	const filmographySubtitle = `${filmography.length} film and TV title${filmography.length === 1 ? "" : "s"} with this person in cast or crew.`;

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
				<div className="mx-auto w-full max-w-lg px-2.5 pb-10 sm:px-3">
					<PersonDetailTmdbButton personId={person.id} />
				</div>
			}
			filmography={
				<div className="mx-auto w-full max-w-7xl px-2.5 pb-10 sm:px-3">
					<MovieDetailBodySection
						title="Filmography"
						subtitle={filmographySubtitle}
						contentClassName="px-1 sm:px-2"
					>
						{filmography.length === 0 ? (
							<p
								className="rounded-2xl bg-card/40 p-10 text-center text-muted-foreground text-sm"
								role="status"
							>
								No film credits loaded yet. Try again after the API syncs with
								TMDb.
							</p>
						) : (
							<PersonFilmographyGrid rows={filmography} />
						)}
					</MovieDetailBodySection>
				</div>
			}
		/>
	);
}
