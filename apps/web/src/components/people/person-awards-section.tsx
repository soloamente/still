import Link from "next/link";

import { FestivalRecognitionIcon } from "@/components/movie/festival-recognition-icon";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { PersonAwardsDrawer } from "@/components/people/person-awards-drawer";
import {
	type PersonAwardRow,
	personAwardWorkHref,
	pickPersonAwardTeaserWins,
} from "@/lib/person-awards";

/**
 * About teaser — up to three win tiles plus View all when more rows or
 * nominations exist (muted trigger when nominations-only).
 */
export function PersonAwardsSection({
	personName,
	rows,
}: {
	personName: string;
	rows: PersonAwardRow[];
}) {
	if (rows.length === 0) return null;

	const teaserWins = pickPersonAwardTeaserWins(rows);
	const nominationsOnly = teaserWins.length === 0;
	const showViewAll =
		nominationsOnly ||
		rows.length > teaserWins.length ||
		rows.some((row) => row.status === "nominated");

	// MovieDetailBodySection h2 “Awards” — same chrome as film About awards.
	return (
		<MovieDetailBodySection title="Awards" className="pt-2 pb-2 sm:pt-4">
			<div className="relative px-3 pt-1 pb-2 sm:px-5">
				{teaserWins.length > 0 ? (
					<ul
						className={
							teaserWins.length === 1
								? "mx-auto flex justify-center gap-x-6 gap-y-10 sm:gap-x-8 lg:gap-x-10 lg:gap-y-12"
								: "mx-auto flex flex-wrap justify-center gap-x-6 gap-y-10 sm:gap-x-8 lg:gap-x-10 lg:gap-y-12"
						}
						aria-label={`Awards won by ${personName}`}
					>
						{teaserWins.map((row) => {
							const workHref = personAwardWorkHref(row);
							const workTitle = row.workTitle?.trim() || null;

							return (
								<li
									key={row.id}
									className="flex w-36 min-w-0 max-w-44 flex-col items-center gap-2.5 overflow-visible text-center sm:w-40 sm:max-w-48 sm:gap-2"
								>
									<div className="flex min-h-11 w-full items-center justify-center overflow-visible sm:min-h-12">
										<FestivalRecognitionIcon icon={row.icon} />
									</div>
									<p className="w-full text-balance font-semibold text-foreground text-sm leading-snug sm:text-[0.9375rem]">
										{row.awardLabel}
									</p>
									{row.year != null ? (
										<p className="w-full text-balance font-medium text-foreground/80 text-xs tabular-nums leading-relaxed sm:text-[0.8125rem]">
											{row.year}
										</p>
									) : null}
									{workTitle ? (
										workHref ? (
											<Link
												href={workHref}
												className="w-full text-balance text-muted-foreground text-xs leading-tight underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-[0.8125rem] [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:underline"
											>
												{workTitle}
											</Link>
										) : (
											<p className="w-full text-balance text-muted-foreground text-xs leading-tight sm:text-[0.8125rem]">
												{workTitle}
											</p>
										)
									) : null}
								</li>
							);
						})}
					</ul>
				) : null}

				{showViewAll ? (
					<div
						className={
							teaserWins.length > 0
								? "mt-10 flex justify-center"
								: "flex justify-center"
						}
					>
						<PersonAwardsDrawer
							personName={personName}
							rows={rows}
							mutedTrigger={nominationsOnly}
						/>
					</div>
				) : null}
			</div>
		</MovieDetailBodySection>
	);
}
