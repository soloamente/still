import { useEffect, useState } from "react";

import { settingDetail } from "../presence/setting-details";
import {
	type ActivitySetting,
	type CompanionSiteId,
	customizableSettings,
	mergeSettingOverrides,
	type SettingValues,
	settingDefaults,
	settingIsVisible,
} from "../presence/settings";
import {
	readStoredSettings,
	writeSiteSetting,
} from "../presence/site-settings";
import { companionSite, companionSites } from "../presence/sites";

type PlaybackSettingsProps = {
	/** Settings page explains each option. The first-run wizard stays short. */
	detailed?: boolean;
};

export function PlaybackSettings({ detailed = false }: PlaybackSettingsProps) {
	const sites = companionSites();
	const [siteId, setSiteId] = useState<CompanionSiteId>("netflix");
	const [values, setValues] = useState<SettingValues>({});
	const site = companionSite(siteId);
	const rows = customizableSettings(site.settings);

	useEffect(() => {
		let cancelled = false;
		void readStoredSettings().then((stored) => {
			if (cancelled) return;
			const current = companionSite(siteId);
			setValues(
				mergeSettingOverrides(
					settingDefaults(current.settings),
					stored[siteId],
				),
			);
		});
		return () => {
			cancelled = true;
		};
	}, [siteId]);

	function handleChange(id: string, value: string | number | boolean) {
		setValues((current) => ({ ...current, [id]: value }));
		void writeSiteSetting(siteId, id, value);
	}

	return (
		<>
			<fieldset className="services">
				<legend className="sr-only">Services</legend>
				{sites.map((entry) => (
					<button
						key={entry.id}
						type="button"
						className={entry.id === siteId ? "service selected" : "service"}
						aria-pressed={entry.id === siteId}
						onClick={() => setSiteId(entry.id)}
					>
						{entry.label}
					</button>
				))}
			</fieldset>
			<ul className="settings" key={siteId}>
				{rows.map((setting) =>
					settingIsVisible(setting, values) ? (
						<li key={setting.id}>
							<SettingControl
								setting={setting}
								detail={
									detailed
										? settingDetail(siteId, setting.id)
										: (setting.description ?? null)
								}
								values={values}
								onChange={handleChange}
							/>
						</li>
					) : null,
				)}
			</ul>
		</>
	);
}

function SettingControl({
	setting,
	detail,
	values,
	onChange,
}: {
	setting: ActivitySetting;
	detail: string | null;
	values: SettingValues;
	onChange: (id: string, value: string | number | boolean) => void;
}) {
	const current = values[setting.id];
	if (typeof current === "boolean") {
		return (
			<button
				type="button"
				className="setting"
				role="switch"
				aria-checked={current}
				onClick={() => onChange(setting.id, !current)}
			>
				<span>
					<span className="setting-title">{setting.title}</span>
					{detail ? <span className="hint">{detail}</span> : null}
				</span>
				<span className={current ? "switch on" : "switch"} aria-hidden="true" />
			</button>
		);
	}

	if (!setting.values) return null;
	const selected = typeof current === "number" ? current : 0;
	return (
		<label className="setting select-row">
			<span>
				<span className="setting-title">{setting.title}</span>
				{detail ? <span className="hint">{detail}</span> : null}
			</span>
			<select
				aria-label={setting.title}
				value={selected}
				onChange={(event) => onChange(setting.id, Number(event.target.value))}
			>
				{setting.values.map((label, index) => (
					<option key={label} value={index}>
						{label}
					</option>
				))}
			</select>
		</label>
	);
}
