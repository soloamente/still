"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { PlanFeatureGate } from "@/components/plans/plan-feature-gate";
import { usePatronEntitlements } from "@/components/plans/use-patron-entitlements";
import { api } from "@/lib/api";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

export type ChallengeListItem = {
	id: string;
	slug: string;
	title: string;
	description: string;
	kind: string;
	subtitle: string;
	badgeId: string;
	enrolled: boolean;
	enrolledAt: string | null;
	completedAt: string | null;
	progress: {
		watched: number;
		total: number;
		percent: number;
		completed: boolean;
	};
};

type ChallengeFilm = {
	movieId: number;
	title: string;
	posterPath: string | null;
	year: number | null;
	watched: boolean;
};

const enrollPillClassName = cn(
	"inline-flex shrink-0 items-center justify-center rounded-full bg-foreground px-4 py-2 font-semibold text-background text-xs",
	DETAIL_MOTION_PRESSABLE_CLASS,
);

const secondaryPillClassName = cn(
	"inline-flex shrink-0 items-center justify-center rounded-full bg-background px-4 py-2 font-semibold text-foreground text-xs",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
);

function ChallengeProgressBar({
	watched,
	total,
	percent,
	label,
	muted,
}: {
	watched: number;
	total: number;
	percent: number;
	/** Shown above the counts — distinguishes diary preview vs active challenge. */
	label: string;
	muted?: boolean;
}) {
	return (
		<div className="space-y-1.5">
			<p className="text-muted-foreground text-xs">{label}</p>
			<div className="flex items-baseline justify-between gap-2 text-xs">
				<span className="text-muted-foreground tabular-nums">
					{watched} / {total} films logged
				</span>
				<span
					className={cn(
						"font-medium tabular-nums",
						muted ? "text-muted-foreground" : "text-foreground",
					)}
				>
					{percent}%
				</span>
			</div>
			<div
				className="h-1.5 overflow-hidden rounded-full bg-background"
				role="progressbar"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={`${watched} of ${total} films logged`}
			>
				<div
					className={cn(
						"h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none",
						muted ? "bg-muted-foreground/50" : "bg-foreground",
					)}
					style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
				/>
			</div>
		</div>
	);
}

function ChallengeCard({
	challenge,
	onEnrolled,
}: {
	challenge: ChallengeListItem;
	onEnrolled: (next: ChallengeListItem) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const [films, setFilms] = useState<ChallengeFilm[] | null>(null);
	const [filmsLoading, setFilmsLoading] = useState(false);
	const [enrollBusy, setEnrollBusy] = useState(false);
	const { hasFeature } = usePatronEntitlements();
	const canJoinChallenges = hasFeature("challenges");

	const completed =
		challenge.completedAt != null || challenge.progress.completed;

	const loadFilms = useCallback(async () => {
		if (films != null) return;
		setFilmsLoading(true);
		try {
			const res = await api.api.challenges({ id: challenge.id }).get();
			const data = res.data as { films?: ChallengeFilm[] } | null;
			setFilms(data?.films ?? []);
		} catch {
			toast.error("Could not load challenge films");
		} finally {
			setFilmsLoading(false);
		}
	}, [challenge.id, films]);

	async function handleEnroll() {
		setEnrollBusy(true);
		try {
			const res = await api.api.challenges({ id: challenge.id }).enroll.post();
			if (res.error) {
				const message =
					typeof res.error.value === "string"
						? res.error.value
						: "Could not join this challenge";
				toast.error(message);
				return;
			}
			const data = res.data as { challenge?: ChallengeListItem } | null;
			if (!data?.challenge) {
				toast.error("Could not join this challenge");
				return;
			}
			onEnrolled(data.challenge);
			toast.success("Challenge joined — badge unlocks when you finish the set");
			if (data.challenge.progress.completed) {
				toast.success("Challenge complete — badge unlocked");
			}
		} catch {
			toast.error("Sign in to join challenges");
		} finally {
			setEnrollBusy(false);
		}
	}

	async function toggleFilms() {
		const next = !expanded;
		setExpanded(next);
		if (next) await loadFilms();
	}

	return (
		<article className="rounded-[1.75rem] bg-background/80 px-4 py-4 sm:px-5 sm:py-5">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						{challenge.subtitle}
					</p>
					<h3 className="mt-1 font-semibold text-base text-foreground tracking-tight">
						{challenge.title}
					</h3>
				</div>
				{completed ? (
					<span className="shrink-0 rounded-full bg-card px-3 py-1 font-medium text-foreground text-xs">
						Complete
					</span>
				) : challenge.enrolled ? (
					<span className="shrink-0 rounded-full bg-card px-3 py-1 font-medium text-muted-foreground text-xs">
						In progress
					</span>
				) : null}
			</div>

			<p className="mt-2 max-w-prose text-balance text-muted-foreground text-sm leading-relaxed">
				{challenge.description}
			</p>

			<div className="mt-4">
				<ChallengeProgressBar
					watched={challenge.progress.watched}
					total={challenge.progress.total}
					percent={challenge.progress.percent}
					label={
						challenge.enrolled || completed
							? "Challenge progress"
							: "From your diary — join to track this set"
					}
					muted={!challenge.enrolled && !completed}
				/>
			</div>

			<div className="mt-4 flex flex-wrap items-center gap-2">
				{!challenge.enrolled && !completed ? (
					canJoinChallenges ? (
						<DetailMotionButton
							type="button"
							disabled={enrollBusy}
							className={enrollPillClassName}
							onClick={() => void handleEnroll()}
						>
							{enrollBusy ? "Joining…" : "Join challenge"}
						</DetailMotionButton>
					) : (
						<PlanFeatureGate featureKey="challenges">
							<span className="sr-only">Join challenge</span>
						</PlanFeatureGate>
					)
				) : null}
				<DetailMotionButton
					type="button"
					className={secondaryPillClassName}
					onClick={() => void toggleFilms()}
				>
					{expanded ? "Hide films" : "View films"}
				</DetailMotionButton>
			</div>

			{expanded ? (
				<div className="mt-4 pt-2">
					{filmsLoading ? (
						<div className="flex justify-center py-6 text-muted-foreground">
							<Loader2 className="size-5 animate-spin" aria-hidden />
						</div>
					) : null}
					{films && films.length > 0 ? (
						<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{films.map((film) => {
								const poster = tmdbPosterUrlFromPath(film.posterPath, "w185");
								return (
									<li key={film.movieId}>
										<Link
											href={`/movies/${film.movieId}`}
											className={cn(
												"flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5",
												"[@media(hover:hover)]:hover:bg-card/80",
											)}
										>
											{poster ? (
												<Image
													src={poster}
													alt=""
													width={36}
													height={54}
													className="aspect-2/3 w-9 shrink-0 rounded-md object-cover"
												/>
											) : (
												<div
													className="aspect-2/3 w-9 shrink-0 rounded-md bg-background"
													aria-hidden
												/>
											)}
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-foreground text-sm">
													{film.title}
												</p>
												<p className="text-muted-foreground text-xs">
													{film.year ?? "—"}
													{film.watched ? " · Logged" : ""}
												</p>
											</div>
										</Link>
									</li>
								);
							})}
						</ul>
					) : null}
					{films && films.length === 0 && !filmsLoading ? (
						<p className="text-center text-muted-foreground text-sm">
							Film list unavailable — try again later.
						</p>
					) : null}
				</div>
			) : null}
		</article>
	);
}

/**
 * Completionist challenges — Zeigarnik-style arcs on the achievements lobby.
 */
export function AchievementsChallengesPanel({
	initialChallenges,
}: {
	initialChallenges: ChallengeListItem[];
}) {
	const [challenges, setChallenges] = useState(initialChallenges);

	useEffect(() => {
		setChallenges(initialChallenges);
	}, [initialChallenges]);

	// RSC can miss the catalog when Eden returns a non-2xx without throwing — recover in the client.
	useEffect(() => {
		if (initialChallenges.length > 0) return;
		let cancelled = false;
		void (async () => {
			const res = await api.api.challenges.catalog.get();
			if (cancelled || res.error || !res.data?.challenges?.length) return;
			setChallenges(res.data.challenges as ChallengeListItem[]);
		})();
		return () => {
			cancelled = true;
		};
	}, [initialChallenges.length]);

	if (challenges.length === 0) {
		return (
			<div className="flex min-h-[min(42svh,28rem)] flex-1 flex-col items-center justify-center px-4 py-12 text-center">
				<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
					No challenges yet
				</p>
				<p className="mt-2 max-w-sm text-balance text-muted-foreground text-sm leading-relaxed">
					Curated film sets will appear here soon.
				</p>
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
			<p className="text-balance text-center text-muted-foreground text-sm leading-relaxed">
				We show how many films you have already logged. Tap{" "}
				<span className="font-medium text-foreground">Join challenge</span> to
				commit to a set and earn the prestige badge when you finish.
			</p>
			{challenges.map((challenge) => (
				<ChallengeCard
					key={challenge.id}
					challenge={challenge}
					onEnrolled={(next) => {
						setChallenges((prev) =>
							prev.map((row) => (row.id === next.id ? next : row)),
						);
					}}
				/>
			))}
		</div>
	);
}
