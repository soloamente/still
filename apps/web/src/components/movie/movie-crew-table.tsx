import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { Fragment } from "react";
import type { CrewRow } from "@/lib/movie-detail-tmdb";
import type { PersonFilmographySeed } from "@/lib/person-filmography";

/**
 * Read-only crew grid — job column + linked names so visitors can open each
 * person’s filmography (TMDb-backed).
 */
export function MovieCrewTable({
	rows,
	appearance = "default",
	onPersonSelect,
}: {
	rows: CrewRow[];
	/** `sheet` — borderless `bg-background` rows for drawers on `bg-card`. */
	appearance?: "default" | "sheet";
	onPersonSelect?: (credit: PersonFilmographySeed) => void;
}) {
	if (!rows.length) return null;
	const isSheet = appearance === "sheet";

	return (
		<div
			className={cn(
				isSheet
					? "space-y-2"
					: "divide-y divide-border rounded-xl border border-border bg-card/40",
			)}
		>
			{rows.map((row) => (
				<div
					key={row.job}
					className={cn(
						"grid gap-2 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-6",
						isSheet
							? "rounded-2xl bg-background px-3 py-2.5 sm:px-4"
							: "px-3 py-2.5 sm:px-4",
					)}
				>
					<p className="font-medium text-muted-foreground text-xs sm:pt-0.5">
						{row.job}
					</p>
					<p className="select-none text-foreground text-sm [&_a]:select-text [&_button]:select-text">
						{row.people.map((p, i) => (
							<Fragment key={p.id}>
								{i > 0 ? ", " : null}
								{isSheet && onPersonSelect ? (
									<button
										type="button"
										className="cursor-pointer underline-offset-2 hover:text-desert-orange hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
										onClick={() =>
											onPersonSelect({
												personId: p.id,
												name: p.name,
												profilePath: null,
												roleHint: row.job,
											})
										}
									>
										{p.name}
									</button>
								) : (
									<Link
										href={`/people/${p.id}`}
										className="underline-offset-2 hover:text-desert-orange hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
									>
										{p.name}
									</Link>
								)}
							</Fragment>
						))}
					</p>
				</div>
			))}
		</div>
	);
}
