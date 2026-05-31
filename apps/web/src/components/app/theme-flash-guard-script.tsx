import Script from "next/script";

import { buildThemeFlashGuardScript } from "@/lib/theme-flash-guard";

/** Runs before React so Lucid (`theme-lobby-light`) does not flash Calm `:root` tokens. */
export function ThemeFlashGuardScript() {
	return (
		<Script
			id="still-theme-flash-guard"
			strategy="beforeInteractive"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: tiny inline bootstrap only
			dangerouslySetInnerHTML={{ __html: buildThemeFlashGuardScript() }}
		/>
	);
}
