"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

/**
 * Hero stills strip — poster + optional backdrop; **page indicators** match the comp:
 * one elongated white pill for the active slide, short muted pills for the rest, tight `gap`,
 * no outer track (pills sit on the canvas).
 */
export function MovieDetailHeroMedia({
	title,
	posterUrl,
	backdropUrl,
	className,
}: {
	title: string;
	posterUrl: string | null;
	backdropUrl: string | null;
	className?: string;
}) {
	const slides = useMemo(() => {
		const out: { key: string; src: string; label: string }[] = [];
		if (posterUrl) {
			out.push({ key: "poster", src: posterUrl, label: `${title} poster` });
		}
		if (backdropUrl && backdropUrl !== posterUrl) {
			out.push({
				key: "backdrop",
				src: backdropUrl,
				label: `${title} still`,
			});
		}
		return out;
	}, [backdropUrl, posterUrl, title]);

	const slideWaveKey = slides.map((s) => s.key).join("|");

	const [index, setIndex] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset active slide when poster/backdrop composition changes.
	useEffect(() => {
		setIndex(0);
	}, [slideWaveKey]);

	const safeIndex = Math.min(index, Math.max(slides.length - 1, 0));
	const active = slides[safeIndex] ?? null;

	const showDots = slides.length > 1;

	if (!active) {
		return (
			<div
				className={cn(
					"relative mx-auto aspect-2/3 w-full max-w-[min(100%,22rem)] overflow-hidden rounded-[1.25rem] bg-muted/25 sm:rounded-[1.5rem]",
					className,
				)}
			>
				<p className="grid size-full place-items-center p-6 text-center text-muted-foreground text-sm">
					<span role="status">No poster yet</span>
				</p>
			</div>
		);
	}

	return (
		<div className={cn("mx-auto w-full max-w-[min(100%,22rem)]", className)}>
			<div className="relative aspect-2/3 overflow-hidden rounded-[1.25rem] bg-muted/20 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.55)] sm:rounded-[1.5rem]">
				{slides.map((s, i) => (
					<div
						key={s.key}
						className={cn(
							"absolute inset-0 transition-opacity duration-300 ease-out motion-reduce:transition-none",
							i === safeIndex ? "opacity-100" : "pointer-events-none opacity-0",
						)}
						aria-hidden={i === safeIndex ? undefined : true}
					>
						<Image
							src={s.src}
							alt={s.label}
							fill
							className={cn(
								"object-cover",
								s.key === "backdrop" && "object-center",
							)}
							sizes="(max-width: 768px) 100vw, 360px"
							priority={i === 0}
						/>
					</div>
				))}
			</div>
			{showDots ? (
				<div
					className="mx-auto mt-4 flex h-1 items-center justify-center gap-1"
					role="tablist"
					aria-label="Artwork slides"
				>
					{slides.map((s, i) => (
						<button
							key={s.key}
							type="button"
							role="tab"
							aria-selected={i === safeIndex}
							className="group -m-3 flex touch-manipulation items-center justify-center p-3"
							onClick={() => setIndex(i)}
						>
							<span
								className={cn(
									"block shrink-0 rounded-full transition-[width,background-color] duration-200 ease-out motion-reduce:transition-none",
									i === safeIndex
										? "h-1 w-8 bg-foreground"
										: "h-1 w-1.5 bg-muted-foreground/45 [@media(hover:hover)]:group-hover:bg-muted-foreground/60",
								)}
							/>
							<span className="sr-only">{s.label}</span>
						</button>
					))}
				</div>
			) : (
				<div className="mt-4 h-1" aria-hidden />
			)}
		</div>
	);
}
