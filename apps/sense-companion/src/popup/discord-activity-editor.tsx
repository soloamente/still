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
} from "../presence/discord-layout";

const SAMPLE = {
	title: "Stranger Things",
	episodeTitle: "Chapter One",
	seasonEpisode: "S4 E1",
	service: "Netflix",
};

const LINE_LABELS = {
	name: "Title line",
	details: "Second line",
	state: "Third line",
	largeText: "Cover tooltip",
} as const;

type LineKey = keyof typeof LINE_LABELS;

/** A Discord card you can retarget. Discord adds the Watching label itself. */
export function DiscordActivityEditor() {
	const [layout, setLayout] = useState<DiscordActivityLayout>(
		DEFAULT_DISCORD_ACTIVITY_LAYOUT,
	);
	const preview = resolveDiscordActivityFields(layout, SAMPLE);

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

	function setLine(key: LineKey, value: DiscordFieldSource) {
		save({ ...layout, [key]: value });
	}

	return (
		<div className="activity-editor">
			<div className="activity-card">
				<label className="activity-cover">
					<span>{layout.cover === "artwork" ? "Cover" : "No cover"}</span>
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
				<label className="activity-cover">
					<span>
						{layout.profileButton === "show"
							? "Profile button"
							: "No profile button"}
					</span>
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
				<div className="activity-copy">
					<p className="activity-type">Watching</p>
					<ActivityLine
						label={LINE_LABELS.name}
						value={layout.name}
						preview={preview.name}
						onChange={(value) => setLine("name", value)}
					/>
					<ActivityLine
						label={LINE_LABELS.details}
						value={layout.details}
						preview={preview.details}
						onChange={(value) => setLine("details", value)}
					/>
					<ActivityLine
						label={LINE_LABELS.state}
						value={layout.state}
						preview={preview.state}
						onChange={(value) => setLine("state", value)}
					/>
					<div className="activity-bar" />
				</div>
				{layout.profileButton === "show" ? (
					<p className="activity-type">View profile</p>
				) : null}
			</div>
			<ActivityLine
				caption="Cover tooltip"
				label={LINE_LABELS.largeText}
				value={layout.largeText}
				preview={preview.largeText}
				onChange={(value) => setLine("largeText", value)}
			/>
			<p className="hint">
				The corner mark stays play or pause. Discord writes Watching above the
				title line.
			</p>
		</div>
	);
}

function ActivityLine(props: {
	label: string;
	caption?: string;
	value: DiscordFieldSource;
	preview: string | null;
	onChange: (value: DiscordFieldSource) => void;
}) {
	return (
		<label className="activity-line">
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
