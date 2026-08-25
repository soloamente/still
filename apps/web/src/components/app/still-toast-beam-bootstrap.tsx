"use client";

import { installStillToastBeamPatch } from "@/lib/still-toast-beam";

// Patch as soon as this client module loads (before first toast from effects).
installStillToastBeamPatch();

/** Keeps the patch module in the Providers tree (side-effect import). */
export function StillToastBeamBootstrap() {
	return null;
}
