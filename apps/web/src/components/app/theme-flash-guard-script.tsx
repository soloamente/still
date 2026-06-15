"use client";

import { useServerInsertedHTML } from "next/navigation";

import { buildThemeFlashGuardScript } from "@/lib/theme-flash-guard";

/**
 * Palette anti-FOUC bootstrap — inserted via the SSR stream, not as a hydrating
 * `<script>` node (React 19 / Next 16 forbid script tags in the client tree).
 */
export function ThemeFlashGuardScript() {
	useServerInsertedHTML(() => (
		<script
			id="still-theme-flash-guard"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: inline bootstrap only
			dangerouslySetInnerHTML={{ __html: buildThemeFlashGuardScript() }}
		/>
	));

	return null;
}
