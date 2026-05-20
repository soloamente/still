import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

/**
 * Mobbin-style floating pill nav — sticky in the page flow (no fixed
 * pointer-events shell that blocks clicks below the bar).
 */
export function LandingNav({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"sticky top-0 z-20 flex justify-center px-4 pt-4 pb-3 sm:pt-5 sm:pb-4",
				className,
			)}
		>
			<header
				className={cn(
					"flex w-full max-w-mobbin-page items-center justify-between gap-4",
					"rounded-full bg-card px-4 py-2.5 shadow-mobbin-xl sm:px-5 sm:py-3",
				)}
			>
				<BrandMark size="md" wordmarkFont="sans" href="/" />
				<nav
					className="hidden items-center gap-1 text-muted-foreground text-sm md:flex"
					aria-label="Marketing"
				>
					<Link
						href="#preview"
						className="rounded-full px-3 py-2 transition-colors duration-200 [@media(hover:hover)]:hover:text-foreground"
					>
						Catalogue
					</Link>
					<Link
						href="#features"
						className="rounded-full px-3 py-2 transition-colors duration-200 [@media(hover:hover)]:hover:text-foreground"
					>
						Features
					</Link>
				</nav>
				<div className="flex shrink-0 items-center gap-2">
					<Link href="/sign-in">
						<Button variant="ghost" size="sm" className="rounded-full">
							Sign in
						</Button>
					</Link>
					<Link href="/sign-up">
						<Button
							variant="accent"
							size="pill"
							className="hidden sm:inline-flex"
						>
							Start logging
						</Button>
						<Button variant="accent" size="sm" className="sm:hidden">
							Join
						</Button>
					</Link>
				</div>
			</header>
		</div>
	);
}
