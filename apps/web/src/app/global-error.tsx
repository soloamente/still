"use client";

import { Button } from "@still/ui/components/button";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en" className="dark">
      <body className="grid min-h-svh place-items-center bg-background text-foreground">
        <div className="max-w-md px-6 text-center">
          <h1 className="font-display text-4xl tracking-[-0.02em]">Lost the reel.</h1>
          <p className="mt-2 text-muted-foreground">
            Something went unrecoverably wrong. Refresh and we&apos;ll start over.
          </p>
          <Button variant="accent" size="pill" className="mt-6" onClick={reset}>
            Reload
          </Button>
        </div>
      </body>
    </html>
  );
}
