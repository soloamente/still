"use client";

import { Toaster } from "@still/ui/components/sonner";

import { CinemaSoundProvider } from "@/components/cinema/sound-provider";
import { ThemeProvider } from "./theme-provider";

/**
 * Aker theme defaults to "dark" — the entire palette is engineered for it.
 * `enableSystem` is left off so visitors don't get an accidental flash of
 * the (intentionally unsupported) light mode while the design system
 * matures. We still pass `disableTransitionOnChange` per the user-rules
 * guidance against animating element styles during theme toggle.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {/* Theater audio persists via profile JSON but still hydrates lazily behind gestures. */}
      <CinemaSoundProvider>{children}</CinemaSoundProvider>
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
