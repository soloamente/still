"use client";

import { Label } from "@still/ui/components/label";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { StillPopoverSelect } from "@/components/ui/still-popover-select";
import { SHEET_FIELD_LABEL_CLASS } from "@/lib/sheet-chrome";
import { fetchTvSeasonDetail, fetchTvSeasons } from "@/lib/still-api-fetch";

/** Season + episode pickers for TV quotes tab and suggest sheet. */
export function QuoteTvEpisodePicker({
	tvId,
	seasonNumber,
	episodeNumber,
	onSeasonChange,
	onEpisodeChange,
	disabled = false,
	/** Sheet forms center labels; tab toolbar keeps compact inline labels. */
	layout = "inline",
}: {
	tvId: number;
	seasonNumber: number | null;
	episodeNumber: number | null;
	onSeasonChange: (season: number) => void;
	onEpisodeChange: (episode: number) => void;
	disabled?: boolean;
	layout?: "inline" | "sheet";
}) {
	const [seasonsLoading, setSeasonsLoading] = useState(true);
	const [seasonOptions, setSeasonOptions] = useState<
		{ season_number: number; name: string }[]
	>([]);
	const [episodesLoading, setEpisodesLoading] = useState(false);
	const [episodes, setEpisodes] = useState<
		{ episode_number: number; name: string }[]
	>([]);

	useEffect(() => {
		let cancelled = false;
		setSeasonsLoading(true);
		void fetchTvSeasons(tvId).then((res) => {
			if (cancelled) return;
			const list = (res.data?.seasons ?? [])
				.filter((s) => s.season_number >= 1)
				.map((s) => ({
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

	// Default to first season when TV quotes tab opens without URL params.
	useEffect(() => {
		if (seasonsLoading || seasonOptions.length === 0) return;
		if (seasonNumber != null) return;
		onSeasonChange(seasonOptions[0]?.season_number ?? 1);
	}, [onSeasonChange, seasonNumber, seasonOptions, seasonsLoading]);

	useEffect(() => {
		if (seasonNumber == null) {
			setEpisodes([]);
			return;
		}
		let cancelled = false;
		setEpisodesLoading(true);
		void fetchTvSeasonDetail(tvId, seasonNumber).then((res) => {
			if (cancelled) return;
			setEpisodes(
				(res.data?.season?.episodes ?? []).map((ep) => ({
					episode_number: ep.episode_number,
					name: ep.name,
				})),
			);
			setEpisodesLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [seasonNumber, tvId]);

	// Default to first episode once season episodes load.
	useEffect(() => {
		if (episodesLoading || episodes.length === 0 || seasonNumber == null)
			return;
		if (episodeNumber != null) return;
		onEpisodeChange(episodes[0]?.episode_number ?? 1);
	}, [episodeNumber, episodes, episodesLoading, onEpisodeChange, seasonNumber]);

	const seasonSelectOptions = seasonOptions.map((s) => ({
		value: String(s.season_number),
		label: s.name,
	}));

	const episodeSelectOptions = episodes.map((ep) => ({
		value: String(ep.episode_number),
		label: `E${ep.episode_number}${ep.name ? ` · ${ep.name}` : ""}`,
	}));

	const labelClass =
		layout === "sheet"
			? SHEET_FIELD_LABEL_CLASS
			: "text-muted-foreground text-xs";

	return (
		<div
			className={cn(
				"grid w-full grid-cols-2 gap-3",
				layout === "sheet" ? "max-w-sm" : "max-w-sm",
			)}
		>
			<div className="space-y-2">
				<Label htmlFor="quote-tv-season" className={labelClass}>
					Season
				</Label>
				{seasonsLoading ? (
					<div className="flex h-11 items-center justify-center rounded-2xl bg-background">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				) : (
					<StillPopoverSelect
						id="quote-tv-season"
						value={seasonNumber != null ? String(seasonNumber) : ""}
						onChange={(next) => onSeasonChange(Number(next))}
						options={seasonSelectOptions}
						placeholder="Season"
						listAriaLabel="Choose season"
						disabled={disabled || seasonSelectOptions.length === 0}
					/>
				)}
			</div>
			<div className="space-y-2">
				<Label htmlFor="quote-tv-episode" className={labelClass}>
					Episode
				</Label>
				{episodesLoading ? (
					<div className="flex h-11 items-center justify-center rounded-2xl bg-background">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				) : (
					<StillPopoverSelect
						id="quote-tv-episode"
						value={episodeNumber != null ? String(episodeNumber) : ""}
						onChange={(next) => onEpisodeChange(Number(next))}
						options={episodeSelectOptions}
						placeholder="Episode"
						listAriaLabel="Choose episode"
						disabled={
							disabled ||
							seasonNumber == null ||
							episodeSelectOptions.length === 0
						}
					/>
				)}
			</div>
		</div>
	);
}
