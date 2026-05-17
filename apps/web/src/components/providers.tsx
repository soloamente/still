"use client";

import { Toaster } from "@still/ui/components/sonner";

import { CinemaSoundProvider } from "@/components/cinema/sound-provider";
import { LenisProvider } from "@/components/lenis-provider";
import { ThemeProvider } from "./theme-provider";

/**
 * Aker theme defaults to **dark** — the palette is engineered for it first.
 * `enableSystem` is on so the account menu can offer **system** next to light/dark;
 * `disableTransitionOnChange` avoids animating tokens during toggles (see user rules).
 */
export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="dark"
			enableSystem
			disableTransitionOnChange
		>
			{/* Lenis: smooth wheel / touch scroll on `window` — `root` avoids an extra scroll wrapper. */}
			<LenisProvider>
				{/* Theater audio persists via profile JSON but still hydrates lazily behind gestures. */}
				<CinemaSoundProvider>{children}</CinemaSoundProvider>
			</LenisProvider>
			<Toaster
				richColors
				theme="dark"
				position="bottom-right"
				toastOptions={{
					classNames: {
						toast: "border-border bg-card text-card-foreground",
					},
				}}
			/>
		</ThemeProvider>
	);
}
