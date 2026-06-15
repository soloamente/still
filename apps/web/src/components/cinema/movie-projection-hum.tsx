"use client";

/**
 * Route-adjacent client hook keeps the looping projector hum anchored to film/TV detail routes.
 */

import { useEffect } from "react";

import { useCinematicAudio } from "@/components/cinema/sound-provider";

/** Starts `projector-hum` when atmosphere audio is enabled; fades out on unmount. */
export function MovieProjectionHum() {
	const { preferencesLoaded, audioPreferences, play, stopSound } =
		useCinematicAudio();

	useEffect(() => {
		if (!preferencesLoaded) return undefined;
		if (!audioPreferences.enabled || !audioPreferences.atmosphere)
			return undefined;
		void play("projector-hum", { category: "atmosphere" }).catch(
			() => undefined,
		);
		return () => stopSound("projector-hum");
	}, [
		preferencesLoaded,
		audioPreferences.enabled,
		audioPreferences.atmosphere,
		play,
		stopSound,
	]);

	return null;
}
