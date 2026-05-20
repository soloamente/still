import { Button } from "@still/ui/components/button";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

/** Mobbin-style dark footer bar — raised ink on the canvas floor. */
export function LandingFooter() {
	const year = new Date().getFullYear();

	return (
		<footer className="mt-8 border-border/40 border-t bg-card/80">
			<div className="mx-auto flex max-w-mobbin-page flex-col gap-8 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-3">
					<BrandMark size="md" wordmarkFont="sans" withTagline href="/" />
					<p className="max-w-xs text-muted-foreground text-sm">
						A modern social home for cinephiles. Free to start — Pro adds deeper
						stats and private lists.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Link href="/sign-in">
						<Button variant="ghost" size="pill">
							Sign in
						</Button>
					</Link>
					<Link href="/sign-up">
						<Button variant="accent" size="pill-lg">
							Create your account
						</Button>
					</Link>
				</div>
			</div>
			<div className="border-border/30 border-t px-6 py-5">
				<p className="mx-auto max-w-mobbin-page text-muted-foreground text-xs">
					© {year} Still
				</p>
			</div>
		</footer>
	);
}
