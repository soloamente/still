import { useEffect, useState } from "react";

import {
	type DiscordDesktopStatus,
	discordStatusCopy,
	discordStatusTone,
	requestDiscordStatus,
} from "../discord/native-host";

/** Discord desktop status — extension talks to Discord over a local socket. */
export function DiscordStatus() {
	const [discord, setDiscord] = useState<DiscordDesktopStatus>("checking");

	useEffect(() => {
		let cancelled = false;
		void requestDiscordStatus().then((next) => {
			if (!cancelled) setDiscord(next);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<>
			<p className={`status ${discordStatusTone(discord)}`} role="status">
				{discordStatusCopy(discord)}
			</p>
			<button
				type="button"
				className="secondary"
				onClick={() => {
					setDiscord("checking");
					void requestDiscordStatus().then(setDiscord);
				}}
			>
				Check again
			</button>
		</>
	);
}
