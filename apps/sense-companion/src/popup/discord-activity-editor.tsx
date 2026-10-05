import { useEffect, useState } from "react";
import { browser } from "wxt/browser";

import {
	DEFAULT_DISCORD_ACTIVITY_LAYOUT,
	DISCORD_FIELD_SOURCE_LABELS,
	DISCORD_FIELD_SOURCES,
	DISCORD_LAYOUT_STORAGE_KEY,
	type DiscordActivityLayout,
	type DiscordFieldSource,
	readDiscordActivityLayout,
	resolveDiscordActivityFields,
	resolveDiscordActivityFromMessage,
} from "../presence/discord-layout";

const SAMPLE = {
	title: "Stranger Things",
	episodeTitle: "Chapter One",
	seasonEpisode: "S4 E1",
	service: "Netflix",
};

/** Same episode Discord receives, so the sample stays on the live card. */
const SAMPLE_MESSAGE = {
	service: SAMPLE.service,
	presenceMode: "playing" as const,
	senseMedia: {
		kind: "episode" as const,
		title: SAMPLE.title,
		season: 4,
		episode: 1,
	},
	activity: {
		name: SAMPLE.title,
		details: SAMPLE.episodeTitle,
		state: null,
		smallImageText: "Playing",
		startTimestamp: 1,
		endTimestamp: 2,
	},
};

/** A Discord card you can retarget. Discord adds the Watching label itself. */
export function DiscordActivityEditor() {
	const [layout, setLayout] = useState<DiscordActivityLayout>(
		DEFAULT_DISCORD_ACTIVITY_LAYOUT,
	);
	const tooltip = resolveDiscordActivityFields(layout, SAMPLE).largeText;
	// Header is "Watching with Sense". The title and one second line are the only rows.
	const card = resolveDiscordActivityFromMessage(SAMPLE_MESSAGE, layout);

	useEffect(() => {
		let cancelled = false;
		void browser.storage.local
			.get(DISCORD_LAYOUT_STORAGE_KEY)
			.then((stored) => {
				if (!cancelled) {
					setLayout(
						readDiscordActivityLayout(stored[DISCORD_LAYOUT_STORAGE_KEY]),
					);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	function save(next: DiscordActivityLayout) {
		setLayout(next);
		void browser.storage.local.set({ [DISCORD_LAYOUT_STORAGE_KEY]: next });
	}

	function setCoverTooltip(value: DiscordFieldSource) {
		save({ ...layout, largeText: value });
	}

	return (
		<div className="activity-editor">
			<div className="activity-card">
				<label className="activity-cover">
					<span>{layout.cover === "artwork" ? "Poster" : "None"}</span>
					<select
						aria-label="Cover"
						value={layout.cover}
						onChange={(event) =>
							save({
								...layout,
								cover: event.target.value === "none" ? "none" : "artwork",
							})
						}
					>
						<option value="artwork">Title art</option>
						<option value="none">Hidden</option>
					</select>
				</label>
				<div className="activity-copy">
					<p className="activity-type">Watching {card?.name ?? "with Sense"}</p>
					<p className="activity-title">{card?.details ?? SAMPLE.title}</p>
					{card?.state ? (
						<p className="activity-subtitle">{card.state}</p>
					) : null}
					<div className="activity-bar" aria-hidden="true" />
					{layout.profileButton === "show" ? (
						<p className="activity-button">View profile</p>
					) : null}
				</div>
			</div>
			<div className="activity-fields">
				<label className="activity-line activity-line-row">
					<span className="activity-caption">Profile button</span>
					<span>{layout.profileButton === "show" ? "Show" : "Hide"}</span>
					<select
						aria-label="Profile button"
						value={layout.profileButton}
						onChange={(event) =>
							save({
								...layout,
								profileButton: event.target.value === "hide" ? "hide" : "show",
							})
						}
					>
						<option value="show">Show</option>
						<option value="hide">Hide</option>
					</select>
				</label>
				<ActivityLine
					row
					caption="Cover tooltip"
					label="Cover tooltip"
					value={layout.largeText}
					preview={tooltip}
					onChange={setCoverTooltip}
				/>
			</div>
			<p className="hint">
				Discord writes Watching with Sense. The corner mark stays play or pause.
			</p>
		</div>
	);
}

function ActivityLine(props: {
	label: string;
	caption?: string;
	/** Setting row under the card, not a line inside the Discord sample. */
	row?: boolean;
	value: DiscordFieldSource;
	preview: string | null;
	onChange: (value: DiscordFieldSource) => void;
}) {
	return (
		<label
			className={
				props.row ? "activity-line activity-line-row" : "activity-line"
			}
		>
			{props.caption ? (
				<span className="activity-caption">{props.caption}</span>
			) : null}
			<span>{props.preview ?? "Empty"}</span>
			<select
				aria-label={props.label}
				value={props.value}
				onChange={(event) => {
					const next = event.target.value;
					if (isFieldSource(next)) props.onChange(next);
				}}
			>
				{DISCORD_FIELD_SOURCES.map((source) => (
					<option key={source} value={source}>
						{DISCORD_FIELD_SOURCE_LABELS[source]}
					</option>
				))}
			</select>
		</label>
	);
}

function isFieldSource(value: string): value is DiscordFieldSource {
	return DISCORD_FIELD_SOURCES.some((source) => source === value);
}
