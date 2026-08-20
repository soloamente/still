"use client";

import { cn } from "@still/ui/lib/utils";
import { ArrowUpRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { CountryFlagIcon } from "@/components/ui/country-flag-icon";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { fetchStreamingPricesClient } from "@/lib/fetch-streaming-prices-client";
import { MOVIE_DETAIL_SECTION } from "@/lib/movie-detail-sections";
import type { MovieDetailListingKind } from "@/lib/movie-detail-view";
import type {
	MovieWatchProviderCountryRow,
	MovieWatchProvidersViewModel,
} from "@/lib/movie-watch-providers";
import { orderCountryRowsByPreferredRegion } from "@/lib/movie-watch-providers";
import {
	findStreamingPricesForProvider,
	type StreamingServicePrices,
} from "@/lib/streaming-offer-prices";
import {
	useHorizontalRailPosterEdgeOpacity,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";

const TMDB_LOGO = (path: string) => `https://image.tmdb.org/t/p/w92${path}`;

/**
 * Streaming tab — horizontal provider picker + per-country rent/buy availability.
 * Matches Mobbin comp: service tiles, sliding selection pill, country table with flags.
 * TMDb lists presence; rent/buy prices overlay the patron watch-region row when
 * Streaming Availability is configured on the server.
 */
export function MovieDetailStreaming({
	listingKind = "movie",
	tmdbId,
	watchProviders,
	/** Film is in cinemas with no past digital bow — empty copy says so (movies only). */
	theatricalOnly = false,
	/** Patron catalogue watch region (ISO 3166-1 alpha-2); null when unset / All countries. */
	catalogWatchRegion = null,
}: {
	listingKind?: MovieDetailListingKind;
	tmdbId: number;
	watchProviders: MovieWatchProvidersViewModel;
	theatricalOnly?: boolean;
	catalogWatchRegion?: string | null;
}) {
	const reduceMotion = useReducedMotion();
	const baseId = useId();
	const countriesPanelId = `${baseId}-countries-panel`;
	const { providers, rowsByProviderId } = watchProviders;
	const [selectedId, setSelectedId] = useState<number | null>(
		providers[0]?.id ?? null,
	);

	const selectedProvider = useMemo(
		() => providers.find((p) => p.id === selectedId) ?? providers[0] ?? null,
		[providers, selectedId],
	);

	const providerTabId = useCallback(
		(providerId: number) => `${baseId}-provider-${providerId}`,
		[baseId],
	);

	/** Select a service; keyboard nav also moves focus + scrolls the rail tile into view. */
	const selectProvider = useCallback(
		(providerId: number, options?: { focus?: boolean }) => {
			setSelectedId(providerId);
			if (!options?.focus) return;
			requestAnimationFrame(() => {
				const tab = document.getElementById(providerTabId(providerId));
				tab?.focus();
				tab?.scrollIntoView({
					inline: "nearest",
					block: "nearest",
					behavior: reduceMotion ? "auto" : "smooth",
				});
			});
		},
		[providerTabId, reduceMotion],
	);

	const onProviderTablistKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			if (!providers.length || selectedProvider == null) return;
			const idx = providers.findIndex((p) => p.id === selectedProvider.id);
			if (idx < 0) return;

			let nextIdx: number | null = null;
			if (e.key === "ArrowRight" || e.key === "ArrowDown") {
				e.preventDefault();
				nextIdx = (idx + 1) % providers.length;
			} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
				e.preventDefault();
				nextIdx = (idx - 1 + providers.length) % providers.length;
			} else if (e.key === "Home") {
				e.preventDefault();
				nextIdx = 0;
			} else if (e.key === "End") {
				e.preventDefault();
				nextIdx = providers.length - 1;
			}
			if (nextIdx == null) return;
			const next = providers[nextIdx];
			if (next) selectProvider(next.id, { focus: true });
		},
		[providers, selectProvider, selectedProvider],
	);

	const preferredRegion = catalogWatchRegion?.trim().toUpperCase() || null;

	const countryRows = useMemo(() => {
		const raw = selectedProvider
			? (rowsByProviderId[selectedProvider.id] ?? [])
			: [];
		return orderCountryRowsByPreferredRegion(raw, preferredRegion);
	}, [preferredRegion, rowsByProviderId, selectedProvider]);

	const preferredListed =
		preferredRegion != null &&
		countryRows.some(
			(row) => row.countryCode.trim().toUpperCase() === preferredRegion,
		);
	const preferredMissing =
		preferredRegion != null && countryRows.length > 0 && !preferredListed;

	/** All-country rent/buy prices — one fetch per title; never steals provider focus. */
	const [offersByCountry, setOffersByCountry] = useState<
		Record<string, StreamingServicePrices[]>
	>({});
	const [pricesConfigured, setPricesConfigured] = useState(false);

	useEffect(() => {
		if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
			setOffersByCountry({});
			setPricesConfigured(false);
			return;
		}
		const controller = new AbortController();
		void fetchStreamingPricesClient({
			listingKind,
			tmdbId,
			signal: controller.signal,
		}).then((payload) => {
			if (controller.signal.aborted || !payload) return;
			setPricesConfigured(payload.configured);
			setOffersByCountry(
				payload.configured ? (payload.offersByCountry ?? {}) : {},
			);
		});
		return () => controller.abort();
	}, [listingKind, tmdbId]);

	const showLivePricesInFooter = useMemo(() => {
		if (!pricesConfigured || !selectedProvider) return false;
		for (const offers of Object.values(offersByCountry)) {
			const match = findStreamingPricesForProvider(
				offers,
				selectedProvider.name,
			);
			if (match?.rent || match?.buy) return true;
		}
		return false;
	}, [offersByCountry, pricesConfigured, selectedProvider]);

	const providerRailRef = useRef<HTMLDivElement>(null);
	const providerRailContentKey = [
		selectedId ?? "none",
		providers.map((provider) => provider.id).join(","),
	].join("\0");
	const providerRailEnabled = providers.length > 0;
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		providerRailRef,
		providerRailEnabled,
		providerRailContentKey,
	);
	// Per-tile opacity at clipped edges — works even when gradient scrims sit under z-10 logos.
	useHorizontalRailPosterEdgeOpacity(
		providerRailRef,
		providerRailEnabled,
		providerRailContentKey,
		{ fadeWidthPx: 48, minOpacity: 0.2 },
	);

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const body = !providers.length ? (
		<div
			className="mx-auto w-full max-w-2xl rounded-2xl bg-background px-6 py-10 text-center"
			role="status"
		>
			{theatricalOnly ? (
				<>
					<p className="font-sans text-foreground text-lg">
						Only in cinemas for now
					</p>
					<p className="mx-auto mt-2 max-w-sm text-balance font-editorial text-muted-foreground text-sm leading-relaxed">
						No streaming or rental options are listed yet. Check back when it
						arrives at home.
					</p>
				</>
			) : (
				<>
					<p className="font-sans text-foreground text-lg">
						No at-home options yet
					</p>
					<p className="mx-auto mt-2 max-w-sm text-balance font-editorial text-muted-foreground text-sm leading-relaxed">
						We don’t have streaming or rental listings for this title right now.
						Check back later.
					</p>
				</>
			)}
		</div>
	) : (
		<div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-8">
			{/* Provider picker — edge fades soften horizontal clip on overflow. */}
			<div className="relative min-w-0 overflow-hidden">
				<div
					aria-hidden
					className={cn(
						// Provider rail sits on the raised `bg-card` detail section — match `--card` scrims.
						"pointer-events-none absolute inset-y-0 left-0 z-20 w-10 bg-linear-to-r from-0% from-card via-35% via-card/70 to-card/0 transition-opacity duration-200 motion-reduce:transition-none",
						showStartFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 right-0 z-20 w-12 bg-linear-to-l from-0% from-card via-35% via-card/70 to-card/0 transition-opacity duration-200 motion-reduce:transition-none",
						showEndFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					ref={providerRailRef}
					data-lenis-prevent-wheel
					className="scrollbar-none flex flex-nowrap items-start gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]"
					role="tablist"
					aria-label="Streaming and rental services"
					onKeyDown={onProviderTablistKeyDown}
				>
					{providers.map((provider) => {
						const active = provider.id === selectedProvider?.id;
						return (
							<button
								key={provider.id}
								id={providerTabId(provider.id)}
								type="button"
								role="tab"
								aria-selected={active}
								aria-controls={countriesPanelId}
								tabIndex={active ? 0 : -1}
								onClick={() => selectProvider(provider.id)}
								className={cn(
									"relative flex w-[5.75rem] shrink-0 flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center opacity-(--edge-opacity) transition-[color,opacity] duration-200 ease-out [--edge-opacity:1] motion-reduce:transition-none",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
									active
										? "text-foreground"
										: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
								)}
							>
								{active ? (
									<motion.span
										layoutId="movie-streaming-provider-pill"
										// Canvas on `bg-card` — `bg-muted/*` vanishes on Cozy where `--muted` === `--card`.
										className="absolute inset-0 z-0 rounded-2xl bg-background"
										transition={pillTransition}
									/>
								) : null}
								{/* Flat raised logo tile — no decorative shadow on detail chrome. */}
								<span className="relative z-10 flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-background">
									{provider.logoPath ? (
										<Image
											src={TMDB_LOGO(provider.logoPath)}
											alt=""
											width={56}
											height={56}
											className="size-full object-cover"
											// Provider logos are tiny TMDb assets — skip Vercel optimization.
											unoptimized
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
			</div>

			{/* Country availability — Rent · Buy with live prices when known. */}
			<div
				id={countriesPanelId}
				role="tabpanel"
				aria-labelledby={
					selectedProvider ? providerTabId(selectedProvider.id) : undefined
				}
				className="min-w-0"
			>
				{preferredMissing ? (
					<p
						className="mb-3 text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed"
						role="status"
					>
						Not listed in your watch region for this service — showing other
						countries below.
					</p>
				) : null}
				{/* Column labels — spacing groups rows; no hairline borders on detail card. */}
				<div className="mb-2 grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1 px-2 font-medium text-muted-foreground text-xs sm:gap-x-3">
					<span>Countries</span>
					{/* Wider columns so formatted prices (A$24.99) don’t wrap. */}
					<span className="min-w-14 text-center sm:min-w-16">Rent</span>
					<span className="min-w-14 text-center sm:min-w-16">Buy</span>
				</div>

				<ul className="flex flex-col gap-1">
					{countryRows.map((row) => {
						const code = row.countryCode.trim().toUpperCase();
						const isPreferred =
							preferredRegion != null && code === preferredRegion;
						const rowOffers = offersByCountry[code] ?? [];
						const prices = selectedProvider
							? findStreamingPricesForProvider(rowOffers, selectedProvider.name)
							: null;
						return (
							<li key={row.countryCode}>
								<CountryAvailabilityRow
									row={row}
									providerName={selectedProvider?.name ?? "this service"}
									isPreferredRegion={isPreferred}
									prices={prices}
								/>
							</li>
						);
					})}
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
				via TMDb
				{showLivePricesInFooter
					? ". Rent and buy amounts are live storefront prices where known."
					: ". Tap a country for options — checkmarks show listing, not live prices."}
			</p>
		</div>
	);

	// Section `<h2>` keeps a heading outline when About’s title `<h1>` is unmounted.
	return (
		<MovieDetailBodySection
			id={MOVIE_DETAIL_SECTION.streaming}
			title="Streaming"
			subtitle="Where this title is listed to stream, rent, or buy."
			className="pt-2 pb-2"
		>
			{body}
		</MovieDetailBodySection>
	);
}

const COUNTRY_ROW_GRID_CLASS =
	"grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-2 py-3 sm:gap-x-3";

/** One country — full-row JustWatch link when TMDb supplies `link`; status checks stay visual. */
function CountryAvailabilityRow({
	row,
	providerName,
	isPreferredRegion = false,
	prices = null,
}: {
	row: MovieWatchProviderCountryRow;
	providerName: string;
	isPreferredRegion?: boolean;
	prices?: StreamingServicePrices | null;
}) {
	const decorative = Boolean(row.link);
	const rentLabel = prices?.rent?.formatted ?? null;
	const buyLabel = prices?.buy?.formatted ?? null;
	const content = (
		<>
			<div className="flex min-w-0 items-center gap-2.5">
				<CountryFlagIcon
					countryCode={row.countryCode}
					size={24}
					className="size-6"
				/>
				<span className="truncate font-medium text-foreground text-sm">
					{row.countryName}
				</span>
				{isPreferredRegion ? (
					<span className="shrink-0 rounded-full bg-card px-2 py-0.5 font-medium text-[10px] text-muted-foreground tracking-wide">
						Your region
					</span>
				) : null}
				{row.link ? (
					<ArrowUpRight
						className="size-3.5 shrink-0 text-muted-foreground opacity-70"
						aria-hidden
					/>
				) : null}
			</div>
			<AvailabilityCell
				available={row.rent}
				priceLabel={rentLabel}
				availableLabel={
					rentLabel
						? `Rent in ${row.countryName} from ${rentLabel}`
						: `Available to rent in ${row.countryName}`
				}
				unavailableLabel={`Not available to rent in ${row.countryName}`}
				decorative={decorative}
			/>
			<AvailabilityCell
				available={row.buy}
				priceLabel={buyLabel}
				availableLabel={
					buyLabel
						? `Buy in ${row.countryName} from ${buyLabel}`
						: `Available to buy in ${row.countryName}`
				}
				unavailableLabel={`Not available to buy in ${row.countryName}`}
				decorative={decorative}
			/>
		</>
	);

	const rowSurfaceClass = cn(
		COUNTRY_ROW_GRID_CLASS,
		"rounded-xl px-2",
		// Raised canvas pin for the patron’s catalogue watch region (surface depth, not borders).
		isPreferredRegion ? "bg-background" : null,
	);

	if (row.link) {
		return (
			<a
				href={row.link}
				target="_blank"
				rel="noopener noreferrer"
				className={cn(
					rowSurfaceClass,
					"select-none",
					DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					"transition-colors duration-150 ease-out motion-reduce:transition-none",
				)}
				aria-label={`Open JustWatch for ${providerName} in ${row.countryName}${
					isPreferredRegion ? " (your region)" : ""
				}`}
			>
				{content}
			</a>
		);
	}

	return <div className={rowSurfaceClass}>{content}</div>;
}

/** Rent / Buy — formatted price when known; otherwise the TMDb presence check. */
function AvailabilityCell({
	available,
	priceLabel,
	availableLabel,
	unavailableLabel,
	decorative = false,
}: {
	available: boolean;
	priceLabel: string | null;
	availableLabel: string;
	unavailableLabel: string;
	decorative?: boolean;
}) {
	const mark =
		available && priceLabel ? (
			<span className="font-medium text-foreground text-xs tabular-nums sm:text-sm">
				{priceLabel}
			</span>
		) : available ? (
			<Check
				className="size-5 shrink-0 text-foreground"
				strokeWidth={2.25}
				aria-hidden
			/>
		) : (
			<span className="text-muted-foreground/45 text-sm" aria-hidden>
				—
			</span>
		);

	const label = available ? availableLabel : unavailableLabel;

	if (decorative) {
		return (
			<span
				className="inline-flex min-h-9 min-w-14 items-center justify-center sm:min-w-16"
				aria-hidden
			>
				{mark}
			</span>
		);
	}

	return (
		<span
			className="inline-flex min-h-9 min-w-14 items-center justify-center sm:min-w-16"
			role="img"
			aria-label={label}
		>
			{mark}
		</span>
	);
}
