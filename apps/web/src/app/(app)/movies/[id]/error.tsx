"use client";

import { Button } from "@still/ui/components/button";
import Link from "next/link";

export default function MovieError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="font-display text-3xl tracking-[-0.02em]">We couldn&apos;t reach this film.</h1>
      <p className="mt-2 text-muted-foreground">
        TMDb may be slow today, or the title was pulled. Try again or pick another.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="accent" size="pill" onClick={reset}>
          Try again
        </Button>
        <Link href="/search">
          <Button variant="ghost-light" size="pill">
            Search
          </Button>
        </Link>
      </div>
    </div>
  );
}
