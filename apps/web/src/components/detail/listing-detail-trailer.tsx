"use client";

import IconMediaPlayFilled from "@still/ui/icons/media-play-filled";
import { cn } from "@still/ui/lib/utils";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { DetailIconTooltip } from "@/components/movie/detail-icon-tooltip";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import {
	DETAIL_MOTION_PRESSABLE_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";
import { buildListingTrailerPlayerSrc } from "@/lib/listing-trailer-embed-src";
import {
	fetchMovieTrailer,
	fetchTvTrailer,
	isFetchAbortError,
} from "@/lib/still-api-fetch";

export type ListingDetailTrailerKind = "movie" | "tv";

type TrailerRow = { trailerKey: string; trailerSite: string };

async function fetchListingTrailer(
	listingKind: ListingDetailTrailerKind,
	tmdbId: number,
	signal?: AbortSignal,
): Promise<TrailerRow | null> {
	if (listingKind === "movie") return fetchMovieTrailer(tmdbId, { signal });
	return fetchTvTrailer(tmdbId, { signal });
}

/** Loads TMDb trailer metadata for listing detail hero actions. */
export function useListingTrailer(
	listingKind: ListingDetailTrailerKind,
	tmdbId: number,
) {
	const [trailer, setTrailer] = useState<TrailerRow | null>(null);
	const [ready, setReady] = useState(false);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const controller = new AbortController();
		setTrailer(null);
		setReady(false);
		void fetchListingTrailer(listingKind, tmdbId, controller.signal)
			.then((row) => {
				if (controller.signal.aborted) return;
				setTrailer(row);
				setReady(true);
			})
			.catch((error: unknown) => {
				// Effect cleanup aborts fetch — must not surface as an unhandled rejection.
				if (isFetchAbortError(error, controller.signal)) return;
				setTrailer(null);
				setReady(true);
			});
		return () => controller.abort();
	}, [listingKind, tmdbId]);

	const embedSrc = useMemo(() => {
		if (!trailer || !open) return null;
		const origin =
			typeof window !== "undefined" ? window.location.origin : undefined;
		return buildListingTrailerPlayerSrc(
			trailer.trailerSite,
			trailer.trailerKey,
			origin,
		);
	}, [open, trailer]);

	return { trailer, ready, open, setOpen, embedSrc };
}

export function ListingDetailTrailerSheet({
	title,
	open,
	onOpenChange,
	embedSrc,
}: {
	title: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	embedSrc: string | null;
}) {
	const sheetTitle = `Trailer — ${title}`;

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={onOpenChange}
			title={sheetTitle}
			description={`Official trailer for ${title}`}
			appStack
		>
			<div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-10">
				<p className="mb-4 text-balance text-center font-sans font-semibold text-foreground text-lg">
					{title}
				</p>
				<div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-muted/30">
					{embedSrc ? (
						<iframe
							title={sheetTitle}
							src={embedSrc}
							className="absolute inset-0 size-full border-0"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
						/>
					) : null}
				</div>
			</div>
		</DetailVaulSheet>
	);
}

/** Circle trailer control — pair with {@link ListingDetailTrailerSheet} at row root. */
export function ListingDetailTrailerCircleButton({
	title,
	circleClassName,
	disabled,
	onOpen,
	layout,
}: {
	title: string;
	circleClassName: string;
	disabled?: boolean;
	onOpen: () => void;
	layout?: boolean;
}) {
	const motionProps = useDetailActionMotion();

	return (
		<DetailIconTooltip label="Trailer">
			<motion.button
				type="button"
				className={cn(
					circleClassName,
					DETAIL_MOTION_PRESSABLE_CLASS,
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					"disabled:pointer-events-none disabled:opacity-40",
				)}
				style={motionProps.style}
				layout={layout}
				layoutId="listing-detail-trailer"
				data-primary-action
				whileHover={motionProps.hover}
				whileTap={motionProps.tap}
				transition={motionProps.buttonTransition}
				onClick={onOpen}
				disabled={disabled}
				aria-label={`Watch trailer for ${title}`}
			>
				<IconMediaPlayFilled
					size="22px"
					className="shrink-0 opacity-90"
					aria-hidden
				/>
			</motion.button>
		</DetailIconTooltip>
	);
}
