import { Calendar, Clapperboard } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { appShellMainContentMinHeightStyle } from "@/components/app/app-shell";
import { MoviePoster } from "@/components/movie/movie-poster";
import { Section } from "@/components/ui/section";
import { formatDate } from "@/lib/format";
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
		title: string;
		posterUrl: string | null;
		/** ISO date string from the API; may deserialize oddly on the client in some stacks. */
		releaseDate: string | null;
		roles: string[];
	}[];
};

/**
 * Filmography rows use `releaseDate` for sorting and display; treat strings and
 * revived `Date` instances the same so `.slice` never runs on non-strings.
 */
function filmographyReleaseYear(raw: unknown): string | null {
	if (raw == null) return null;
	if (typeof raw === "string") {
		const s = raw.trim();
		return s.length >= 4 ? s.slice(0, 4) : s || null;
	}
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		return String(raw.getFullYear());
	}
	return null;
}

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
			<div
				className="flex w-full flex-col justify-center"
				style={appShellMainContentMinHeightStyle}
			>
				<div className="mx-auto max-w-lg text-center">
					<p className="text-muted-foreground text-sm">{data.hint}</p>
				</div>
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

	// Horizontal: narrower column centered in `max-w-7xl`.
	// Vertical: flex + min-height aligns short pages in the band above the bottom nav (`(app)` layout).
	return (
		<div
			className="flex w-full flex-col justify-center"
			style={appShellMainContentMinHeightStyle}
		>
			<article className="mx-auto w-full max-w-5xl space-y-10 pt-6 pb-12">
				<header className="flex flex-col gap-6 sm:flex-row sm:items-start">
					<div className="relative mx-auto aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-md border border-border bg-card sm:mx-0 sm:w-40 md:w-44">
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
							<p className="line-clamp-6 max-w-3xl text-pretty text-foreground/85 text-sm leading-relaxed sm:line-clamp-none">
								{person.biography.trim()}
							</p>
						) : null}
						<p className="text-muted-foreground text-xs">
							Credits from{" "}
							<a
								href={`https://www.themoviedb.org/person/${person.id}`}
								className="underline underline-offset-2 hover:text-foreground"
								target="_blank"
								rel="noreferrer"
							>
								TMDb
							</a>
							.
						</p>
					</div>
				</header>

				<Section
					title="Filmography"
					subtitle={`${data.filmography.length} title${data.filmography.length === 1 ? "" : "s"} with this person in cast or crew.`}
				>
					{data.filmography.length === 0 ? (
						<p className="rounded-2xl border border-border border-dashed bg-card/40 p-10 text-center text-muted-foreground text-sm">
							No film credits loaded yet. Try again after the API syncs with
							TMDb.
						</p>
					) : (
						<div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
							{data.filmography.map((m) => {
								const yearLabel = filmographyReleaseYear(m.releaseDate);
								return (
									<div key={m.tmdbId} className="min-w-0">
										<MoviePoster
											movieId={m.tmdbId}
											title={m.title}
											posterUrl={m.posterUrl}
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

				<p className="text-center text-muted-foreground text-xs">
					<Link
						href="/search"
						className="underline underline-offset-2 hover:text-foreground"
					>
						Search films
					</Link>
				</p>
			</article>
		</div>
	);
}
