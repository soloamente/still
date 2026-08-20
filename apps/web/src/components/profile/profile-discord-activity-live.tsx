"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { ProfileDiscordActivityRow } from "@/components/profile/profile-discord-activity-row";
import {
	DISCORD_ACTIVITY_POLL_MS,
	discordActivityTransitionKey,
} from "@/lib/discord-activity-poll";
import {
	fetchProfileDiscordActivityClient,
	type ProfileDiscordActivity,
} from "@/lib/fetch-profile-discord-activity-client";

/** ease-out — matches `--ease-out` / detail swap vocabulary. */
const DISCORD_ACTIVITY_SWAP_EASE = [0.23, 1, 0.32, 1] as const;

type ProfileDiscordActivityLiveProps = {
	handle: string;
	initialActivity: ProfileDiscordActivity | null;
	/** Signed-in viewers may poll Lanyard-backed activity on profile hero. */
	pollEnabled: boolean;
	className?: string;
};

/**
 * Profile hero Discord activity — polls while mounted and crossfades on track changes.
 */
export function ProfileDiscordActivityLive({
	handle,
	initialActivity,
	pollEnabled,
	className,
}: ProfileDiscordActivityLiveProps) {
	const reduceMotion = useReducedMotion();
	const [activity, setActivity] = useState(initialActivity);

	// Keep in sync when navigating between profiles (RSC payload).
	useEffect(() => {
		setActivity(initialActivity);
	}, [initialActivity]);

	const refreshActivity = useCallback(async () => {
		try {
			const payload = await fetchProfileDiscordActivityClient(handle);
			setActivity(payload.visible === true ? payload.activity : null);
		} catch (err) {
			console.error("[ProfileDiscordActivityLive] fetch failed:", err);
		}
	}, [handle]);

	useEffect(() => {
		if (!pollEnabled || !handle.trim()) return;

		void refreshActivity();

		const pollTimer = window.setInterval(
			refreshActivity,
			DISCORD_ACTIVITY_POLL_MS,
		);

		// Catch up immediately when the patron returns to the tab.
		function handleVisibilityChange() {
			if (document.visibilityState === "visible") {
				void refreshActivity();
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.clearInterval(pollTimer);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [handle, pollEnabled, refreshActivity]);

	const swapTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: DISCORD_ACTIVITY_SWAP_EASE };

	return (
		<div aria-live="polite" aria-atomic="true" className={className}>
			<AnimatePresence mode="wait" initial={false}>
				{activity ? (
					<motion.div
						key={discordActivityTransitionKey(activity)}
						className="mx-auto w-full max-w-md"
						initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
						transition={swapTransition}
					>
						<ProfileDiscordActivityRow activity={activity} className="mt-3" />
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
