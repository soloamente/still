"use client";

import type { ReactNode } from "react";

import { CinemaSoundProvider } from "@/components/cinema/sound-provider";
import { BadgeWatcher } from "@/components/gamification/badge-watcher";
import { StreakAudioWatcher } from "@/components/gamification/streak-audio-watcher";

/**
 * Signed-in and public-share film routes live under `(app)`; keep theater audio
 * context in one client boundary with gamification watchers so `useCinematicAudio`
 * always resolves (root `Providers` alone can miss nested server chrome).
 */
export function AppPatronAudioScope({
	children,
	gamificationWatchers = false,
}: {
	children: ReactNode;
	gamificationWatchers?: boolean;
}) {
	return (
		<CinemaSoundProvider>
			{children}
			{gamificationWatchers ? (
				<>
					<BadgeWatcher />
					<StreakAudioWatcher />
				</>
			) : null}
		</CinemaSoundProvider>
	);
}
