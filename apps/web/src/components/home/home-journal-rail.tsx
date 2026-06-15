"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

import type { JournalListItem } from "@/lib/fetch-journal";
import { formatTimeAgoLabel } from "@/lib/format";
import { useHorizontalScrollFades } from "@/lib/use-horizontal-scroll-fades";

/** Fixed editorial tile — stretch to the tallest card in the row. */
const JOURNAL_RAIL_CELL_CLASSNAME =
	"flex w-56 shrink-0 self-stretch flex-col sm:w-60";

function JournalRailCard({ post }: { post: JournalListItem }) {
	return (
		<Link
			href={`/journal/${post.slug}`}
			className={cn(
				"flex h-full min-h-0 w-full flex-col rounded-2xl bg-background p-3 text-left",
				"transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100",
			)}
		>
			<div className="relative mb-3 aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl bg-card">
				{post.heroImageUrl ? (
					<Image
						src={post.heroImageUrl}
						alt=""
						fill
						sizes="(max-width: 640px) 224px, 240px"
						className="object-cover"
						unoptimized={post.heroImageUrl.startsWith("http")}
					/>
				) : null}
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-1">
				{post.publishedAt ? (
					<p className="font-medium text-[11px] text-muted-foreground tabular-nums tracking-wide">
						{formatTimeAgoLabel(post.publishedAt)}
					</p>
				) : null}
				<h3 className="line-clamp-2 text-balance font-semibold text-foreground text-sm leading-snug">
					{post.title}
				</h3>
				{post.dek ? (
					<p className="line-clamp-2 text-pretty text-muted-foreground text-xs leading-relaxed">
						{post.dek}
					</p>
				) : null}
			</div>
		</Link>
	);
}

/** Latest published journal essays — horizontal scroll on the Movies lobby. */
export function HomeJournalRail({ posts }: { posts: JournalListItem[] }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const railContentKey = posts.map((post) => post.id).join("\0");
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		posts.length > 0,
		railContentKey,
	);

	if (posts.length === 0) return null;

	return (
		<section className="mb-6 w-full min-w-0" aria-label="From the journal">
			<div className="mb-3 flex items-center justify-center gap-3">
				<h2 className="text-balance text-center font-medium text-foreground text-sm">
					From the journal
				</h2>
				<Link
					href="/journal"
					className="shrink-0 text-muted-foreground text-xs transition-colors [@media(hover:hover)]:hover:text-foreground"
				>
					All posts
				</Link>
			</div>
			<div className="relative min-w-0 overflow-hidden">
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-card via-card/80 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
						showStartFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-card via-card/80 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
						showEndFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					ref={scrollRef}
					className="scrollbar-none overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					data-lenis-prevent-wheel
				>
					<div className="flex min-w-full justify-center">
						<ul className="flex w-max items-stretch gap-3">
							{posts.map((post) => (
								<li key={post.id} className={JOURNAL_RAIL_CELL_CLASSNAME}>
									<JournalRailCard post={post} />
								</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</section>
	);
}
