"use client";

import { Button } from "@still/ui/components/button";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] caught error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-4xl tracking-[-0.02em]">Something stalled.</h1>
      <p className="mt-2 text-muted-foreground">
        We logged it. Try again — most of the time it just blinks back to life.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="accent" size="pill" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
