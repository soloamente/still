import { cn } from "@still/ui/lib/utils";

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
