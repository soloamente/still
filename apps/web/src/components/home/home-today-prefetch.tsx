"use client";

import { useCallback, useEffect, useState } from "react";

import { HomeTasteMatchedHero } from "@/components/home/home-taste-matched-hero";
import { HomeTasteMatchedHeroSkeleton } from "@/components/home/home-taste-matched-hero-skeleton";
import { TodayCircleCard } from "@/components/home/today-circle-card";
import { TodayCircleCardSkeleton } from "@/components/home/today-circle-card-skeleton";
import { TodayWeekCard } from "@/components/home/today-week-card";
import { TodayWeekCardSkeleton } from "@/components/home/today-week-card-skeleton";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import {
	shouldPrefetchInactiveToday,
	type TodayPrefetchTrigger,
} from "@/lib/home-today-prefetch";
import { isStillApiErrorPayload } from "@/lib/still-api-error-payload";
import { stillApiOrigin } from "@/lib/still-api-origin";
import type { TasteMatchedDiscoveryPayload } from "@/lib/taste-matched-discovery";
import type { TodayCirclePayload } from "@/lib/today-circle";
import type { TodayMedia, TodayWeekRead } from "@/lib/today-on-sense-reads";
import type { TodayWeekPulse } from "@/lib/today-week-pulse";

type InactiveTodayPayload = {
	pick: TasteMatchedDiscoveryPayload | null;
	week: TodayWeekRead;
	circle: TodayCirclePayload | null;
};

function todayEndpoint(path: string, media: TodayMedia): URL {
	const url = new URL(path, stillApiOrigin());
	// Movie reads stay parameter-free. TV is the only `media` query.
	if (media === "tv") url.searchParams.set("media", "tv");
	return url;
}

async function readOkJson(response: Response): Promise<unknown> {
	if (!response.ok) return null;
	try {
		const data = (await response.json()) as unknown;
		if (isStillApiErrorPayload(data)) return null;
		return data;
	} catch {
		return null;
	}
}

/** Inactive tab's three Today reads — credentials stay on the web origin. */
async function fetchInactiveToday(
	media: TodayMedia,
	signal: AbortSignal,
): Promise<InactiveTodayPayload> {
	const timeZone = readViewerTimeZone();
	const weekUrl = todayEndpoint("/api/today/week", media);
	weekUrl.searchParams.set("tz", timeZone);
	const [pickRes, weekRes, circleRes] = await Promise.all([
		fetch(todayEndpoint("/api/taste/for-you", media), {
			credentials: "include",
			cache: "no-store",
			signal,
		}),
		fetch(weekUrl, {
			credentials: "include",
			cache: "no-store",
			signal,
		}),
		fetch(todayEndpoint("/api/today/circle", media), {
			credentials: "include",
			cache: "no-store",
			signal,
		}),
	]);
	const [pickJson, weekJson, circleJson] = await Promise.all([
		readOkJson(pickRes),
		readOkJson(weekRes),
		readOkJson(circleRes),
	]);
	return {
		pick: pickJson as TasteMatchedDiscoveryPayload | null,
		week: {
			pulse: weekJson as TodayWeekPulse | null,
			timeZone,
		},
		circle: circleJson as TodayCirclePayload | null,
	};
}

function InactiveTodaySkeleton({ media }: { media: TodayMedia }) {
	return (
		<>
			<HomeTasteMatchedHeroSkeleton media={media} />
			<div className="relative z-10 grid min-w-0 gap-3 sm:grid-cols-2">
				<TodayWeekCardSkeleton />
				<TodayCircleCardSkeleton />
			</div>
		</>
	);
}

/**
 * Prefetches the Today tab that is not on screen. Mount shows the existing
 * skeletons; paint or a hover on that browse pill fetches once, then the
 * client hero, week, and circle render. A failed read passes `null` so those
 * cards show their empty/error tiles.
 */
export function HomeTodayPrefetch({ media }: { media: TodayMedia }) {
	const [inactiveRequested, setInactiveRequested] = useState(false);
	const [payload, setPayload] = useState<InactiveTodayPayload | null>(null);
	// This instance flips between the inactive catalogues. Clear the previous
	// payload before paint so a show is never drawn with film routes.
	const [seenMedia, setSeenMedia] = useState(media);
	if (seenMedia !== media) {
		setSeenMedia(media);
		setPayload(null);
		setInactiveRequested(false);
	}

	const requestInactive = useCallback((trigger: TodayPrefetchTrigger) => {
		setInactiveRequested((already) =>
			shouldPrefetchInactiveToday({
				inactiveRequested: already,
				trigger,
			})
				? true
				: already,
		);
	}, []);

	// After this subtree paints with the active Today — not on mount.
	useEffect(() => {
		// Re-arm after a catalogue flip cleared `inactiveRequested`. `media` is a
		// real dependency: the flip does not change `requestInactive`.
		requestInactive(seenMedia === media ? "painted" : "mount");
	}, [requestInactive, media, seenMedia]);

	// The other Movies / TV Shows pill. Community hover does not start Today.
	useEffect(() => {
		const onIntent = (event: Event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const button = target.closest("button");
			if (!(button instanceof HTMLButtonElement)) return;
			if (button.closest('[aria-label="Lobby source"]') == null) return;
			const label = button.getAttribute("aria-label") ?? "";
			const hovered: TodayMedia | null = label.startsWith("TV shows")
				? "tv"
				: label.startsWith("Movies")
					? "movie"
					: null;
			if (hovered !== media) return;
			requestInactive("hover");
		};
		document.addEventListener("pointerover", onIntent);
		document.addEventListener("focusin", onIntent);
		return () => {
			document.removeEventListener("pointerover", onIntent);
			document.removeEventListener("focusin", onIntent);
		};
	}, [media, requestInactive]);

	useEffect(() => {
		if (!inactiveRequested) return;
		const controller = new AbortController();
		fetchInactiveToday(media, controller.signal)
			.then((next) => {
				if (!controller.signal.aborted) setPayload(next);
			})
			.catch((err: unknown) => {
				if (controller.signal.aborted) return;
				if (err instanceof DOMException && err.name === "AbortError") return;
				console.error("[home-today-prefetch] inactive Today failed", err);
				setPayload({
					pick: null,
					week: { pulse: null, timeZone: readViewerTimeZone() },
					circle: null,
				});
			});
		return () => controller.abort();
	}, [inactiveRequested, media]);

	const headingId = `today-on-sense-prefetch-${media}`;

	return (
		<section
			aria-labelledby={headingId}
			className="flex min-w-0 flex-col gap-3 pb-2"
		>
			<h2 id={headingId} className="sr-only">
				Today on Sense
			</h2>
			{payload == null ? (
				<InactiveTodaySkeleton media={media} />
			) : (
				<>
					<HomeTasteMatchedHero
						initial={payload.pick}
						completionMode="today-shell"
						media={media}
					/>
					<div className="relative z-10 grid min-w-0 gap-3 sm:grid-cols-2">
						<TodayWeekCard
							initial={payload.week.pulse}
							initialTimeZone={payload.week.timeZone}
							media={media}
						/>
						<TodayCircleCard media={media} payload={payload.circle} />
					</div>
				</>
			)}
		</section>
	);
}
