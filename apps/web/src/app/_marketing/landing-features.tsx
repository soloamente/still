import { cn } from "@still/ui/lib/utils";
import { Film, List, MessagesSquare, Trophy } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Feature band — zig-zag two-up layout (design-taste: no generic 3-column card row).
 * Surfaces use elevation shadows instead of bordered cards.
 */
export function LandingFeatures() {
	return (
		<section
			id="features"
			className="relative mx-auto max-w-mobbin-page scroll-mt-24 px-6 py-20 sm:py-28"
		>
			<div className="max-w-[52ch]">
				<p className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
					Everything in one diary
				</p>
				<h2 className="mt-3 font-sans font-semibold text-3xl tracking-[-0.025em] md:text-4xl">
					Built for how you actually watch.
				</h2>
			</div>

			<div className="mt-12 flex flex-col gap-6 lg:gap-8">
				<div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
					<FeaturePanel
						icon={<Film className="size-5 text-desert-orange" aria-hidden />}
						eyebrow="Diary"
						title="Log every screening with venue and date."
						body="Half-star ratings, rewatch counts, private notes, and cinema vs at-home — films and series share the same flow."
						className="lg:min-h-[16rem]"
					/>
					<FeaturePanel
						icon={<List className="size-5 text-desert-orange" aria-hidden />}
						eyebrow="Lists"
						title="Curate taste, not just rankings."
						body="Cover art from your picks, shareable lists, and a community tab when you want inspiration instead of algorithms."
						className="lg:translate-y-6"
					/>
				</div>
				<div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
					<FeaturePanel
						icon={
							<MessagesSquare
								className="size-5 text-desert-orange"
								aria-hidden
							/>
						}
						eyebrow="Social"
						title="Follow people whose taste you trust."
						body="Friend activity on the lobby, DMs when you need to argue about a cut, and profiles that read like a filmography — not a feed."
						className="lg:-translate-y-4"
					/>
					<FeaturePanel
						icon={<Trophy className="size-5 text-desert-orange" aria-hidden />}
						eyebrow="Achievements"
						title="Quietly prestigious badges."
						body="Quests for silents, directors, venues, and streaks — surfaced on your profile without turning watching into homework."
					/>
				</div>
			</div>
		</section>
	);
}

function FeaturePanel({
	icon,
	eyebrow,
	title,
	body,
	className,
}: {
	icon: ReactNode;
	eyebrow: string;
	title: string;
	body: string;
	className?: string;
}) {
	return (
		<article
			className={cn(
				"flex flex-col rounded-mobbin-3xl bg-card p-8 shadow-mobbin-xl sm:p-10",
				className,
			)}
		>
			<div className="mb-5 inline-flex size-11 items-center justify-center rounded-2xl bg-background shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
				{icon}
			</div>
			<p className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
				{eyebrow}
			</p>
			<h3 className="mt-2 font-sans font-semibold text-xl tracking-[-0.02em] md:text-2xl">
				{title}
			</h3>
			<p className="mt-3 max-w-prose text-muted-foreground text-sm leading-relaxed md:text-base">
				{body}
			</p>
		</article>
	);
}
