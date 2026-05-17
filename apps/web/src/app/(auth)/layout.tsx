import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";

/**
 * Cinematic split layout: a hero column with a still-image vignette
 * (gradient + grain placeholder) on the left, the form column on the
 * right. Mobile collapses to a single column, hero becomes a band.
 *
 * Typography: Fraunces is limited to the Capra quotation; SF Pro Rounded (`font-sans`)
 * carries the wordmark and the entire sign-in / sign-up form column per design feedback.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
	return (
		<div className="grid min-h-svh grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
			{/* Hero rail: Fraunces only on the blockquote below; wordmark stays UI sans (`font-sans`). */}
			<aside className="relative hidden overflow-hidden bg-deep-graphite lg:flex">
				<div
					aria-hidden
					className="absolute inset-0 bg-[radial-gradient(120%_80%_at_30%_20%,rgba(183,89,40,0.25),transparent_60%),radial-gradient(80%_60%_at_70%_90%,rgba(119,97,87,0.25),transparent_60%)]"
				/>
				<div
					aria-hidden
					className="absolute inset-0 bg-[url('https://image.tmdb.org/t/p/original/zfbjgQE1uSd9wiPTX4VzsLi0rGG.jpg')] bg-center bg-cover opacity-30 mix-blend-luminosity"
				/>
				<div className="relative z-10 flex w-full flex-col justify-between p-10 font-sans">
					<BrandMark size="lg" wordmarkFont="sans" />
					<div>
						<p className="max-w-md font-display text-2xl text-pure-white/85 leading-snug">
							&ldquo;Film is a disease. When it infects your bloodstream it
							takes over as the number one hormone.&rdquo;
						</p>
						<p className="mt-3 text-slate-border text-sm">— Frank Capra</p>
					</div>
				</div>
			</aside>
			{/* Form rail: SF Pro Rounded everywhere; avoid `font-display` on headings (see sign-in page). */}
			<main className="flex flex-col font-sans">
				<header className="flex items-center justify-between px-6 py-5 lg:hidden">
					<BrandMark wordmarkFont="sans" />
					<Link
						href="/"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						Back home
					</Link>
				</header>
				<div className="flex flex-1 items-center justify-center px-6 py-10">
					<div className="w-full max-w-sm">{children}</div>
				</div>
			</main>
		</div>
	);
}
