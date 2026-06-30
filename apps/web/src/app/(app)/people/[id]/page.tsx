import { Calendar, Clapperboard } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { MoviePoster } from "@/components/movie/movie-poster";
import {
	PERSON_PAGE_PILL_CLASS,
	PersonPageBackPill,
} from "@/components/people/person-page-back-pill";
import { Section } from "@/components/ui/section";
import { formatDate } from "@/lib/format";
import {
	filmographyReleaseYear,
	sortFilmographyByYearDesc,
} from "@/lib/person-filmography";
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
		knownForDepartment?: string;
		profilePath: string | null;
		profileUrl: string | null;
	} | null;
	filmography: {
		tmdbId: number;
		mediaKind: "movie" | "tv";
		title: string;
		posterUrl: string | null;
		/** ISO date string from the API; may deserialize oddly on the client in some stacks. */
		releaseDate: string | null;
		roles: string[];
	}[];
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
}: {
	params: Promise<Params>;
}) {
	const { id } = await params;
	const numericId = Number(id);
	if (!Number.isFinite(numericId)) notFound();

	const api = await serverApi();
	const res = await api.api
		.people({ id })
		.get()
		.catch(() => ({ data: null as PersonPayload | null }));
	const data = res.data as PersonPayload | null;

	if (!data) notFound();

	if (data.code === "TMDB_UNCONFIGURED") {
		return (
			<div className="mx-auto w-full max-w-5xl px-1 pt-6 pb-12">
				<PersonPageBackPill />
				<p className="mx-auto mt-16 max-w-lg text-center text-muted-foreground text-sm">
					{data.hint}
				</p>
			</div>
		);
	}

	const person = data.person;
	if (!person) notFound();

	const lifeSpan =
		person.birthday || person.deathday
			? [
					person.birthday ? formatDate(new Date(person.birthday)) : "?",
					person.deathday ? formatDate(new Date(person.deathday)) : null,
				]
					.filter(Boolean)
					.join(" — ")
			: null;

	const filmography = sortFilmographyByYearDesc(data.filmography);

	return (
		<article className="mx-auto w-full max-w-5xl space-y-8 pt-6 pb-12">
			<div className="flex items-center justify-between gap-3 px-1">
				<PersonPageBackPill />
				<a
					href={`https://www.themoviedb.org/person/${person.id}`}
					className={PERSON_PAGE_PILL_CLASS}
					target="_blank"
					rel="noreferrer"
				>
					View on TMDb
				</a>
			</div>

			<header className="flex flex-col gap-6 sm:flex-row sm:items-start">
				<div className="relative mx-auto aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-2xl border border-border bg-card sm:mx-0 sm:w-40 md:w-44">
					{person.profileUrl ? (
						<Image
							src={person.profileUrl}
							alt={person.name}
							fill
							className="object-cover"
							sizes="176px"
							priority
						/>
					) : (
						<div className="grid size-full place-items-center text-muted-foreground">
							<Clapperboard className="size-10" aria-hidden />
						</div>
					)}
				</div>
				<div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
					{person.knownForDepartment ? (
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
							{person.knownForDepartment}
						</p>
					) : null}
					<h1 className="font-editorial font-medium text-3xl text-foreground tracking-tight md:text-4xl">
						{person.name}
					</h1>
					{lifeSpan ? (
						<p className="flex items-center justify-center gap-2 text-muted-foreground text-sm sm:justify-start">
							<Calendar className="size-4 shrink-0" aria-hidden />
							{lifeSpan}
						</p>
					) : null}
					{person.biography?.trim() ? (
						<p className="line-clamp-6 max-w-3xl text-pretty text-foreground/85 text-sm leading-relaxed">
							{person.biography.trim()}
						</p>
					) : null}
				</div>
			</header>

			<Section
				title="Filmography"
				subtitle={`${filmography.length} film and TV title${filmography.length === 1 ? "" : "s"} with this person in cast or crew.`}
			>
				{filmography.length === 0 ? (
					<p className="rounded-2xl bg-card/40 p-10 text-center text-muted-foreground text-sm">
						No film credits loaded yet. Try again after the API syncs with TMDb.
					</p>
				) : (
					<div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
						{filmography.map((m) => {
							const yearLabel = filmographyReleaseYear(m.releaseDate);
							return (
								<div key={`${m.mediaKind}-${m.tmdbId}`} className="min-w-0">
									<MoviePoster
										movieId={m.tmdbId}
										title={m.title}
										posterUrl={m.posterUrl}
										listingKind={m.mediaKind === "tv" ? "tv" : "movie"}
										showTitle
									/>
									<p className="mt-1 line-clamp-3 text-[10px] text-muted-foreground leading-snug">
										{m.roles.join(" · ")}
									</p>
									{yearLabel ? (
										<p className="mt-0.5 text-[10px] text-muted-foreground/80 tabular-nums">
											{yearLabel}
										</p>
									) : null}
								</div>
							);
						})}
					</div>
				)}
			</Section>
		</article>
	);
}
