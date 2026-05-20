import { cn } from "@still/ui/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CreditsCatalog } from "@/components/movie/credits-catalog";
import { MovieThemeProvider } from "@/components/movie/movie-theme-provider";
import { accentFromGenres } from "@/lib/cinema-accents";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import { buildCrewRows } from "@/lib/movie-detail-tmdb";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type Params = { id: string };

type TmdbJsonShape = {
	genres?: { id: number; name: string }[];
	credits?: {
		cast?: {
			id: number;
			name: string;
			character?: string;
			profile_path: string | null;
		}[];
		crew?: {
			id: number;
			name: string;
			job?: string;
			department?: string;
			profile_path: string | null;
		}[];
	};
} | null;

type Detail = {
	tmdbId: number;
	title: string;
	paletteAccent: string | null;
	paletteMuted: string | null;
	paletteForeground: string | null;
	tmdbJson: TmdbJsonShape;
};

export async function generateMetadata({
	params,
}: {
	params: Promise<Params>;
}) {
	const { id } = await params;
	const api = await serverApi();
	const res = await api.api
		.movies({ id })
		?.get?.()
		.catch(() => ({ data: null }));
	const data = res?.data as { title?: string } | null;
	return {
		title: data?.title ? `Cast & crew · ${data.title}` : "Cast & crew",
	};
}

/**
 * Full credits catalog — direct URL; in-page “View all” opens the same content in a Vaul drawer.
 */
export default async function MovieCreditsPage({
	params,
}: {
	params: Promise<Params>;
}) {
	const { id } = await params;
	const numericId = Number(id);
	if (!Number.isFinite(numericId)) notFound();

	const api = await serverApi();
	const res = await api.api.movies({ id }).get();
	const data = (res.data as Detail | null) ?? null;
	if (!data) notFound();

	const j = data.tmdbJson;
	const fullCast = j?.credits?.cast ?? [];
	const crewRows = buildCrewRows(
		j?.credits?.crew as Parameters<typeof buildCrewRows>[0],
		80,
	);
	const { accent: movieAccent } = accentFromGenres(j?.genres);
	const backHref = `/movies/${data.tmdbId}`;

	return (
		<MovieThemeProvider
			genreAccent={movieAccent}
			paletteAccent={data.paletteAccent}
			paletteMuted={data.paletteMuted}
			paletteForeground={data.paletteForeground}
		>
			<div className="flex min-h-0 flex-1 flex-col bg-background">
				<header className="sticky top-0 z-30 w-full bg-background px-2.5 py-2 sm:px-3">
					<div className="flex items-center gap-3">
						<Link
							href={backHref}
							className={cn(
								"inline-flex min-h-10 items-center gap-2 rounded-full bg-card px-4 py-2 font-medium text-sm",
								"transition-colors duration-200 ease-out [@media(hover:hover)]:hover:bg-muted/35",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							)}
						>
							<ArrowLeft className="size-4 shrink-0 opacity-90" aria-hidden />
							Back
						</Link>
					</div>
				</header>

				<section
					className={cn(
						HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
						"mx-2.5 mb-4 min-h-0 flex-1 sm:mx-3",
					)}
				>
					<CreditsCatalog
						title={data.title}
						cast={fullCast}
						crewRows={crewRows}
					/>
				</section>
			</div>
		</MovieThemeProvider>
	);
}
