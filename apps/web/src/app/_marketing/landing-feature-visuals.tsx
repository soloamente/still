import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

import type { LandingPoster } from "./landing-poster";

/** Mobbin specimen shell — flat card in the gray well (no shadow). */
const SPECIMEN_CARD_CLASS =
	"w-full max-w-[15.5rem] shrink-0 overflow-hidden rounded-2xl bg-card text-left";

/** Centered success pill — mirrors Mobbin “Copied to Figma”. */
export function LandingFeatureQuickLogVisual() {
	return (
		<div
			className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 font-sans font-semibold text-background text-sm"
			aria-hidden
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				aria-hidden
				className="shrink-0"
			>
				<title>Checkmark</title>
				<path
					d="M3.5 8.2 6.4 11.1 12.5 5"
					stroke="currentColor"
					strokeWidth="1.75"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			Logged at home
		</div>
	);
}

/** “Save to collections” picker — Mobbin middle column. */
export function LandingFeatureAddToListVisual({
	posters,
}: {
	posters: LandingPoster[];
}) {
	const picks = posters.filter((p) => p.posterUrl).slice(0, 3);
	const collections = [
		{ name: "Watchlist", selected: false },
		{ name: "Sci-fi essentials", selected: true },
		{ name: "Festival picks", selected: false },
	] as const;

	return (
		<div className={SPECIMEN_CARD_CLASS} aria-hidden>
			<div className="space-y-1 border-border/40 border-b px-3 py-2.5">
				<p className="font-sans text-[0.65rem] text-muted-foreground uppercase tracking-wide">
					Quick save
				</p>
				<p className="font-medium font-sans text-foreground text-xs">Library</p>
			</div>
			<div className="px-3 pt-3 pb-1">
				<p className="font-sans text-[0.65rem] text-muted-foreground uppercase tracking-wide">
					Add to list
				</p>
				<p className="mt-1 font-medium font-sans text-foreground text-xs">
					Create list
				</p>
			</div>
			<ul className="space-y-0.5 px-2 pb-2">
				{collections.map((collection, index) => {
					const poster = picks[index];
					return (
						<li
							key={collection.name}
							className={cn(
								"flex list-none items-center gap-2 rounded-xl px-2 py-2",
								collection.selected && "bg-muted/55",
							)}
						>
							<div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-muted">
								{poster?.posterUrl ? (
									<Image
										src={poster.posterUrl}
										alt=""
										fill
										sizes="36px"
										className="poster-art object-cover"
									/>
								) : null}
							</div>
							<span className="min-w-0 flex-1 truncate font-sans text-foreground text-xs">
								{collection.name}
							</span>
							{collection.selected ? (
								<svg
									width="14"
									height="14"
									viewBox="0 0 16 16"
									fill="none"
									aria-hidden
									className="shrink-0 text-foreground"
								>
									<title>Selected</title>
									<path
										d="M3.5 8.2 6.4 11.1 12.5 5"
										stroke="currentColor"
										strokeWidth="1.75"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							) : null}
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/** Review thread card — Mobbin “Leave comments” column. */
export function LandingFeatureReviewVisual() {
	return (
		<div className={cn(SPECIMEN_CARD_CLASS, "p-4")} aria-hidden>
			<div className="flex items-center gap-2">
				<span className="size-8 shrink-0 rounded-full bg-muted" />
				<div>
					<p className="font-medium font-sans text-foreground text-xs">You</p>
					<p className="text-[0.65rem] text-muted-foreground">8h ago</p>
				</div>
			</div>
			<p className="mt-3 font-sans text-foreground text-xs leading-relaxed">
				Loved this third act — the score and the closing shot stayed with me all
				week.
			</p>
			<div className="mt-4 rounded-xl bg-muted/50 px-3 py-2.5">
				<p className="font-sans text-muted-foreground text-xs">Add a review…</p>
			</div>
		</div>
	);
}

/** Community feed — flat rows for flows / activity specimen. */
export function LandingFeatureCommunityVisual() {
	const rows = [
		{ name: "Maya", action: "reviewed", title: "Past Lives" },
		{ name: "Jon", action: "ranked", title: "Sci-fi essentials" },
		{ name: "Rin", action: "logged", title: "The Bear" },
	] as const;

	return (
		<div className={cn(SPECIMEN_CARD_CLASS, "p-3")} aria-hidden>
			<ul className="flex flex-col gap-2">
				{rows.map((row) => (
					<li
						key={row.title}
						className="flex list-none items-start gap-2.5 rounded-xl bg-muted/40 px-2.5 py-2"
					>
						<span
							aria-hidden
							className="mt-0.5 size-7 shrink-0 rounded-full bg-muted"
						/>
						<div className="min-w-0 text-left">
							<p className="font-sans text-foreground text-xs leading-snug">
								<span className="font-medium">{row.name}</span>{" "}
								<span className="text-muted-foreground">{row.action}</span>{" "}
								<span className="font-medium">{row.title}</span>
							</p>
							<p className="mt-1 text-[0.65rem] text-muted-foreground">
								2h ago
							</p>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

/** Sticky search bar with token pills + inline poster hits. */
export function LandingFeatureSearchVisual({
	posters,
}: {
	posters: LandingPoster[];
}) {
	const hits = posters.filter((p) => p.posterUrl).slice(6, 9);

	return (
		<div className={cn(SPECIMEN_CARD_CLASS, "p-3")} aria-hidden>
			<div className="rounded-full bg-muted/45 px-3 py-2.5">
				<p className="font-sans text-muted-foreground text-xs">
					Search films, TV, lists…
				</p>
			</div>
			<div className="mt-2.5 flex flex-wrap gap-1.5">
				<span className="rounded-full bg-foreground px-2.5 py-1 font-sans text-[0.65rem] text-background">
					Films
				</span>
				<span className="rounded-full bg-muted/55 px-2.5 py-1 font-sans text-[0.65rem] text-foreground">
					Anime
				</span>
			</div>
			<ul className="mt-3 grid grid-cols-3 gap-1.5">
				{hits.map((poster) => (
					<li key={poster.id} className="list-none">
						<div className="relative aspect-2/3 overflow-hidden rounded-lg bg-muted">
							<Image
								src={poster.posterUrl ?? ""}
								alt=""
								fill
								sizes="72px"
								className="poster-art object-cover"
							/>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

/** TV watch progress — segmented scope control + status line. */
export function LandingFeatureTvWatchVisual({
	posters,
}: {
	posters: LandingPoster[];
}) {
	const show = posters.find((p) => p.posterUrl);

	return (
		<div className={cn(SPECIMEN_CARD_CLASS, "p-3")} aria-hidden>
			<div className="flex items-center gap-2">
				<div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
					{show?.posterUrl ? (
						<Image
							src={show.posterUrl}
							alt=""
							fill
							sizes="40px"
							className="poster-art object-cover"
						/>
					) : null}
				</div>
				<div className="min-w-0">
					<p className="truncate font-medium font-sans text-foreground text-xs">
						{show?.title ?? "Series title"}
					</p>
					<p className="text-[0.65rem] text-muted-foreground">Watching · S2</p>
				</div>
			</div>
			<div className="mt-3 flex rounded-full bg-muted/40 p-0.5">
				<span className="flex-1 rounded-full bg-card py-1.5 text-center font-sans text-[0.65rem] text-foreground">
					Watching
				</span>
				<span className="flex-1 py-1.5 text-center font-sans text-[0.65rem] text-muted-foreground">
					By season
				</span>
			</div>
			<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/50">
				<div className="h-full w-[62%] rounded-full bg-foreground" />
			</div>
			<p className="mt-2 font-sans text-[0.65rem] text-muted-foreground">
				6 of 10 episodes logged
			</p>
		</div>
	);
}

/** Film ranks podium — community leaderboard specimen. */
export function LandingFeatureRanksVisual() {
	const podium = [
		{ place: "2", handle: "@maya", score: "128" },
		{ place: "1", handle: "@jon", score: "214" },
		{ place: "3", handle: "@rin", score: "96" },
	] as const;

	return (
		<div className={cn(SPECIMEN_CARD_CLASS, "px-3 py-4")} aria-hidden>
			<p className="text-center font-medium font-sans text-foreground text-xs">
				Film ranks · Month
			</p>
			<ul className="mt-4 flex list-none items-end justify-center gap-2">
				{podium.map((entry) => {
					const isApex = entry.place === "1";
					return (
						<li
							key={entry.place}
							className={cn(
								"flex w-17 flex-col items-center rounded-xl bg-muted/40 px-1.5 py-2 text-center",
								isApex && "min-h-22 bg-muted/65 pb-3",
							)}
						>
							<span className="font-sans font-semibold text-[0.65rem] text-muted-foreground">
								#{entry.place}
							</span>
							<span className="mt-1.5 size-7 rounded-full bg-muted" />
							<p className="mt-1.5 truncate font-medium font-sans text-[0.6rem] text-foreground">
								{entry.handle}
							</p>
							<p className="mt-0.5 font-sans text-[0.6rem] text-muted-foreground tabular-nums">
								{entry.score}
							</p>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
