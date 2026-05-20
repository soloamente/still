"use client";

import { Button } from "@still/ui/components/button";
import Link from "next/link";

export default function TvShowError({ reset }: { reset: () => void }) {
	return (
		<div className="mx-auto max-w-md py-20 text-center">
			<h1 className="font-display text-3xl tracking-[-0.02em]">
				We couldn&apos;t reach this series.
			</h1>
			<p className="mt-2 text-muted-foreground">
				TMDb may be slow today, or the listing was removed. Try again or pick
				another title.
			</p>
			<div className="mt-6 flex justify-center gap-2">
				<Button variant="accent" size="pill" onClick={reset}>
					Try again
				</Button>
				<Link href="/home">
					<Button variant="ghost-light" size="pill">
						Home
					</Button>
				</Link>
			</div>
		</div>
	);
}
