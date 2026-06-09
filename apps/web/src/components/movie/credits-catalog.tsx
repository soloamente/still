"use client";

import { MovieCrewTable } from "@/components/movie/movie-crew-table";
import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import type { CrewRow } from "@/lib/movie-detail-tmdb";
import type { PersonFilmographySeed } from "@/lib/person-filmography";
import { useCastCrewMonochromeOnHover } from "@/lib/use-cast-crew-monochrome-pref";

export type CreditsCastMember = {
	id: number;
	name: string;
	character?: string;
	profile_path: string | null;
};

export type CreditsCatalogProps = {
	title: string;
	cast: CreditsCastMember[];
	crewRows: CrewRow[];
	/** `sheet` — borderless surfaces; person taps open nested drawer instead of routing. */
	appearance?: "default" | "sheet";
	onPersonSelect?: (credit: PersonFilmographySeed) => void;
};

function CastCard({
	member,
	isSheet,
	onPersonSelect,
	monochromeOnHover,
}: {
	member: CreditsCastMember;
	isSheet: boolean;
	onPersonSelect?: (credit: PersonFilmographySeed) => void;
	monochromeOnHover: boolean;
}) {
	const inner = (
		<>
			<div className="relative aspect-3/4 overflow-hidden rounded-2xl bg-muted/30 transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:-translate-y-0.5">
				<PersonCreditPortrait
					name={member.name}
					profilePath={member.profile_path}
					grayscale={monochromeOnHover}
				/>
			</div>
			<p className="mt-2 line-clamp-1 font-medium text-foreground text-xs">
				{member.name}
			</p>
			{member.character ? (
				<p className="line-clamp-2 text-[11px] text-muted-foreground">
					{member.character}
				</p>
			) : null}
		</>
	);

	if (isSheet && onPersonSelect) {
		return (
			<button
				type="button"
				className="group block w-full cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				onClick={() =>
					onPersonSelect({
						personId: member.id,
						name: member.name,
						profilePath: member.profile_path,
						roleHint: member.character?.trim() || undefined,
					})
				}
			>
				{inner}
			</button>
		);
	}

	return (
		<a
			href={`/people/${member.id}`}
			className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
		>
			{inner}
		</a>
	);
}

/**
 * Full cast grid + crew table — shared by the credits route and the Vaul drawer.
 */
export function CreditsCatalog({
	title,
	cast,
	crewRows,
	appearance = "default",
	onPersonSelect,
}: CreditsCatalogProps) {
	const isSheet = appearance === "sheet";
	const monochromeOnHover = useCastCrewMonochromeOnHover();

	return (
		<div className="mx-auto max-w-4xl space-y-10">
			<div className="text-center">
				<p className="text-muted-foreground text-xs uppercase tracking-wider">
					{title}
				</p>
				<h2 className="mt-2 font-semibold text-2xl tracking-tight">
					Cast &amp; crew
				</h2>
			</div>

			{cast.length ? (
				<div>
					<h3 className="mb-4 text-center font-medium text-foreground text-sm">
						Cast
						<span className="ml-2 text-muted-foreground tabular-nums">
							({cast.length})
						</span>
					</h3>
					<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
						{cast.map((c) => (
							<li key={`${c.id}-${c.character ?? ""}`}>
								<CastCard
									member={c}
									isSheet={isSheet}
									onPersonSelect={onPersonSelect}
									monochromeOnHover={monochromeOnHover}
								/>
							</li>
						))}
					</ul>
				</div>
			) : null}

			{crewRows.length ? (
				<div>
					<h3 className="mb-4 text-center font-medium text-foreground text-sm">
						Crew
					</h3>
					<MovieCrewTable
						rows={crewRows}
						appearance={appearance}
						onPersonSelect={isSheet ? onPersonSelect : undefined}
					/>
				</div>
			) : null}

			{!cast.length && !crewRows.length ? (
				<p
					className="rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
					role="status"
				>
					No credits published for this title yet.
				</p>
			) : null}
		</div>
	);
}
