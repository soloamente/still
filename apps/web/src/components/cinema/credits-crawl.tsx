"use client";

import { cn } from "@still/ui/lib/utils";
import { type CSSProperties, useEffect, useId, useState } from "react";

/** One crawl block — role label (JOB / DEPARTMENT) plus person lines beneath. */
export interface CreditsCrawlLine {
	role: string;
	/** Display names shown under the role; keep each row short-ish for readability. */
	people: string[];
}

/**
 * Slow vertical crawl for “closing credits” moments (crew blocks, wrap lines).
 *
 * Hover or keyboard focus pauses motion so readers can skim. Duplicate content
 * + translateY loops seamlessly. When `prefers-reduced-motion` is enabled,
 * resolves to a static, scrollable column (respects accessibility policy).
 */
export function CreditsCrawl({
	lines,
	durationSec = 120,
	className,
}: {
	lines: CreditsCrawlLine[];
	/** Seconds for half the marquee (matches duplicated track height via -50%). */
	durationSec?: number;
	className?: string;
}) {
	const blockId = useId();
	const [mounted, setMounted] = useState(false);
	/** After mount only — avoids SSR/CSS mismatch vs `matchMedia`; first paint stays static-ish. */
	const [motionOk, setMotionOk] = useState(true);

	useEffect(() => {
		setMounted(true);
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setMotionOk(!mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);

	const visibleLines = lines.filter((l) =>
		l.people.some((p) => p.trim().length > 0),
	);
	if (!visibleLines.length) return null;

	const style = {
		"--credits-duration": `${durationSec}s`,
	} as CSSProperties;

	const crawlBlocks = visibleLines.map((line) => (
		<div
			key={`${blockId}:${line.role}`}
			className="mb-14 text-center last:mb-0"
		>
			<p className="mb-5 font-display font-medium text-[12px] text-desert-orange/90 uppercase tracking-[0.42em] md:text-[11px]">
				{line.role}
			</p>
			<ul className="space-y-3 text-[13px] text-muted-foreground leading-snug tracking-wide md:text-sm">
				{(() => {
					const nameCounts = new Map<string, number>();
					return line.people.filter(Boolean).map((person) => {
						const occurrence = nameCounts.get(person) ?? 0;
						nameCounts.set(person, occurrence + 1);
						return (
							<li key={`${line.role}:${person}:${occurrence}`}>{person}</li>
						);
					});
				})()}
			</ul>
		</div>
	));

	const useScroll = mounted && motionOk;

	return (
		<section
			className={cn(
				// No border, fill, or shadow — only the masked crawl reads on the page wash.
				"cinema-credits-crawl-surface relative outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				// Static column: constrain height so long lists scroll instead of towering the page.
				!useScroll &&
					"max-h-[min(22rem,calc(100vh-8rem))] overflow-y-auto py-10 [scrollbar-width:thin]",
				useScroll &&
					"h-[min(22rem,calc(100vh-9rem))] overflow-hidden pt-12 pb-10 [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)]",
				className,
			)}
			style={style}
			aria-label="Scrolling credits — hover or focus to pause"
		>
			{!useScroll ? (
				<div className="px-6">{crawlBlocks}</div>
			) : (
				<div className="relative h-full">
					{/* Track duplicates content for seamless loop; animation defined in globals.css. */}
					<div className="cinema-credits-crawl-track px-10 will-change-transform">
						<div>{crawlBlocks}</div>
						<div className="cinema-credits-crawl-ghost" aria-hidden>
							{crawlBlocks}
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
