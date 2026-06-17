"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * Thin wrapper around `next-themes`. React 19 / Next 16 forbid `<script>` in the
 * client tree — see `patches/next-themes@0.4.6.patch` (ThemeScript SSR-only).
 */
export function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
