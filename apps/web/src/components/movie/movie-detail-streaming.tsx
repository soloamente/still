"use client";

import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useMemo, useState } from "react";

import { CountryFlagIcon } from "@/components/ui/country-flag-icon";
import type { MovieWatchProvidersViewModel } from "@/lib/movie-watch-providers";

const TMDB_LOGO = (path: string) => `https://image.tmdb.org/t/p/w92${path}`;

/**
 * Streaming tab — horizontal provider picker + per-country rent/buy availability.
 * Matches Mobbin comp: service tiles, sliding selection pill, country table with flag + price pills.
 * TMDb does not return prices; pills link to JustWatch (per-country `link`) when present.
 */
export function MovieDetailStreaming({
	watchProviders,
}: {
	watchProviders: MovieWatchProvidersViewModel;
}) {
	const reduceMotion = useReducedMotion();
	const { providers, rowsByProviderId } = watchProviders;
	const [selectedId, setSelectedId] = useState<number | null>(
		providers[0]?.id ?? null,
	);

	const selectedProvider = useMemo(
		() => providers.find((p) => p.id === selectedId) ?? providers[0] ?? null,
		[providers, selectedId],
	);

	const countryRows = selectedProvider
		? (rowsByProviderId[selectedProvider.id] ?? [])
		: [];

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	if (!providers.length) {
		return (
			<div
				className="mx-auto w-full max-w-2xl rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
				role="status"
			>
				No streaming or rental links from TMDb yet — try again after the next
				sync.
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full min-w-0 max-w-2xl flex-1 flex-col gap-8">
			{/* Provider picker — native horizontal scroll; Lenis ignores wheel here. */}
			<div
				data-lenis-prevent-wheel
				className="scrollbar-none -mx-1 flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [-webkit-overflow-scrolling:touch]"
				role="tablist"
				aria-label="Streaming and rental services"
			>
				{providers.map((provider) => {
					const active = provider.id === selectedProvider?.id;
					return (
						<button
							key={provider.id}
							type="button"
							role="tab"
							aria-selected={active}
							onClick={() => setSelectedId(provider.id)}
							className={cn(
								"relative flex w-[5.75rem] shrink-0 flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors duration-200 ease-out motion-reduce:transition-none",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
								active
									? "text-foreground"
									: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
							)}
						>
							{active ? (
								<motion.span
									layoutId="movie-streaming-provider-pill"
									className="absolute inset-0 z-0 rounded-2xl bg-muted/50"
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10 flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-background shadow-sm">
								{provider.logoPath ? (
									<Image
										src={TMDB_LOGO(provider.logoPath)}
										alt=""
										width={56}
										height={56}
										className="size-full object-cover"
									/>
								) : (
									<span className="font-semibold text-[10px] uppercase tracking-wide">
										{provider.name.slice(0, 2)}
									</span>
								)}
							</span>
							<span className="relative z-10 line-clamp-2 w-full font-medium text-xs leading-tight">
								{provider.name}
							</span>
							<span className="relative z-10 text-[11px] text-muted-foreground leading-none">
								{provider.countryCount}{" "}
								{provider.countryCount === 1 ? "country" : "countries"}
							</span>
						</button>
					);
				})}
			</div>

			{/* Country availability table */}
			<div className="min-w-0">
				<div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 border-border/40 border-b pb-2 font-medium text-muted-foreground text-xs">
					<span>Countries</span>
					<span className="min-w-18 text-right">Watch</span>
					<span className="min-w-18 text-right">Buy</span>
				</div>

				<ul className="divide-y divide-border/30">
					{countryRows.map((row) => (
						<li
							key={row.countryCode}
							className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-2 py-3"
						>
							<div className="flex min-w-0 items-center gap-2.5">
								<CountryFlagIcon
									countryCode={row.countryCode}
									size={24}
									className="size-6"
								/>
								<span className="truncate font-medium text-foreground text-sm">
									{row.countryName}
								</span>
							</div>
							<AvailabilityCheck
								available={row.rent || row.flatrate}
								label={
									row.rent || row.flatrate
										? `Available to watch in ${row.countryName}`
										: `Not available to watch in ${row.countryName}`
								}
							/>
							<AvailabilityCheck
								available={row.buy}
								label={
									row.buy
										? `Available to buy in ${row.countryName}`
										: `Not available to buy in ${row.countryName}`
								}
							/>
						</li>
					))}
				</ul>
			</div>

			<p className="text-center text-[11px] text-muted-foreground/80 leading-relaxed">
				Availability data from{" "}
				<a
					href="https://www.justwatch.com"
					target="_blank"
					rel="noopener noreferrer"
					className="underline decoration-muted-foreground/40 underline-offset-2 [@media(hover:hover)]:text-muted-foreground"
				>
					JustWatch
				</a>{" "}
				via TMDb. Checkmarks show where this service lists the title — not live
				prices.
			</p>
		</div>
	);
}

/** Rent / Buy columns — check when TMDb lists availability (no price data). */
function AvailabilityCheck({
	available,
	label,
}: {
	available: boolean;
	label: string;
}) {
	return (
		<span
			className="inline-flex min-h-9 min-w-18 items-center justify-end"
			role="img"
			aria-label={label}
		>
			{available ? (
				<Check
					className="size-5 shrink-0 text-foreground"
					strokeWidth={2.25}
					aria-hidden
				/>
			) : (
				<span className="text-muted-foreground/45 text-sm" aria-hidden>
					—
				</span>
			)}
		</span>
	);
}
