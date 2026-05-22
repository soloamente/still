"use client";

import { Label } from "@still/ui/components/label";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { StillPopoverSelect } from "@/components/ui/still-popover-select";
import { fetchTvSeasonDetail, fetchTvSeasons } from "@/lib/still-api-fetch";
import type { TvEpisodeSummary, TvLogScope } from "@/lib/tv-watch-types";

const SCOPE_OPTIONS: { id: TvLogScope; label: string }[] = [
	{ id: "episode", label: "Episode" },
	{ id: "season", label: "Season" },
	{ id: "show", label: "Whole show" },
];

/**
 * TV diary scope controls inside Quick Log — home-style segmented toolbar + settings-style selects.
 */
export function TvLogScopePicker({
	tvId,
	logScope,
	seasonNumber,
	episodeNumber,
	onScopeChange,
	onSeasonChange,
	onEpisodeChange,
}: {
	tvId: number;
	logScope: TvLogScope;
	seasonNumber: number | null;
	episodeNumber: number | null;
	onScopeChange: (scope: TvLogScope) => void;
	onSeasonChange: (season: number | null) => void;
	onEpisodeChange: (episode: number | null) => void;
}) {
	const [seasonsLoading, setSeasonsLoading] = useState(true);
	const [seasonOptions, setSeasonOptions] = useState<
		{ season_number: number; name: string }[]
	>([]);
	const [episodesLoading, setEpisodesLoading] = useState(false);
	const [episodes, setEpisodes] = useState<TvEpisodeSummary[]>([]);

	useEffect(() => {
		let cancelled = false;
		setSeasonsLoading(true);
		void fetchTvSeasons(tvId).then((res) => {
			if (cancelled) return;
			const list = (res.data?.seasons ?? []).map((s) => ({
				season_number: s.season_number,
				name: s.name || `Season ${s.season_number}`,
			}));
			setSeasonOptions(list);
			setSeasonsLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [tvId]);

	useEffect(() => {
		if (logScope !== "episode" || seasonNumber == null) {
			setEpisodes([]);
			return;
		}
		let cancelled = false;
		setEpisodesLoading(true);
		void fetchTvSeasonDetail(tvId, seasonNumber).then((res) => {
			if (cancelled) return;
			setEpisodes(res.data?.season?.episodes ?? []);
			setEpisodesLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [tvId, logScope, seasonNumber]);

	const seasonSelectOptions = seasonOptions.map((s) => ({
		value: String(s.season_number),
		label: s.name,
	}));

	const episodeSelectOptions = episodes.map((ep) => ({
		value: String(ep.episode_number),
		label: `E${ep.episode_number}${ep.name ? ` · ${ep.name}` : ""}`,
	}));

	return (
		<fieldset className="mx-auto mb-5 w-full max-w-sm border-0 p-0">
			<legend className="mb-3 block w-full text-center font-medium text-muted-foreground text-xs">
				What are you logging?
			</legend>
			<div className="flex justify-center">
				<SegmentedPillToolbar
					layoutId="quick-log-tv-scope-pill"
					aria-label="Diary scope"
					value={logScope}
					onChange={(next) => {
						onScopeChange(next);
						if (next === "show") {
							onSeasonChange(null);
							onEpisodeChange(null);
						}
					}}
					compact
					options={SCOPE_OPTIONS}
				/>
			</div>

			{logScope === "season" || logScope === "episode" ? (
				<div className="mt-4 space-y-3">
					<div className="space-y-1.5">
						<Label
							htmlFor="quick-log-tv-season"
							className="text-muted-foreground text-xs"
						>
							Season
						</Label>
						{seasonsLoading ? (
							<div className="flex min-h-11 items-center justify-center">
								<Loader2 className="size-4 animate-spin text-muted-foreground" />
							</div>
						) : (
							<StillPopoverSelect
								id="quick-log-tv-season"
								value={seasonNumber != null ? String(seasonNumber) : ""}
								placeholder="Choose season"
								listAriaLabel="Season"
								options={seasonSelectOptions}
								onChange={(next) => {
									const n = Number(next);
									onSeasonChange(Number.isFinite(n) ? n : null);
									onEpisodeChange(null);
								}}
							/>
						)}
					</div>

					{logScope === "episode" ? (
						<div className="space-y-1.5">
							<Label
								htmlFor="quick-log-tv-episode"
								className="text-muted-foreground text-xs"
							>
								Episode
							</Label>
							{episodesLoading ? (
								<div className="flex min-h-11 items-center justify-center">
									<Loader2 className="size-4 animate-spin text-muted-foreground" />
								</div>
							) : (
								<StillPopoverSelect
									id="quick-log-tv-episode"
									value={episodeNumber != null ? String(episodeNumber) : ""}
									placeholder="Choose episode"
									listAriaLabel="Episode"
									disabled={seasonNumber == null}
									options={episodeSelectOptions}
									onChange={(next) => {
										const n = Number(next);
										onEpisodeChange(Number.isFinite(n) ? n : null);
									}}
								/>
							)}
						</div>
					) : null}
				</div>
			) : null}
		</fieldset>
	);
}
