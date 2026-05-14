"use client";

/**
 * Route-adjacent client hook keeps the looping projector hum anchored to `/movies/[id]` routes.
 */

import { useEffect } from "react";

import { useCinematicAudio } from "@/components/cinema/sound-provider";

/** Starts `projector-hum` whenever the bearer route is mounted; fades out via Web Audio ramps on exit. */
export function MovieProjectionHum() {
  const { preferencesLoaded, theaterAudioEnabled, play, stopSound } = useCinematicAudio();

  useEffect(() => {
    if (!preferencesLoaded || !theaterAudioEnabled) return undefined;
    void play("projector-hum").catch(() => undefined);
    return () => stopSound("projector-hum");
  }, [preferencesLoaded, theaterAudioEnabled, play, stopSound]);

  return null;
}
