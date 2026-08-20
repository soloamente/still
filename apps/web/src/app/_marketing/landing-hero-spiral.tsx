"use client";

import { useEffect, useState } from "react";

import SpiralImages from "@/components/originkit/ui/spiralimages";

import type { LandingHeroPoster } from "./landing-hero-still";

/**
 * Full-bleed spiral layer for the landing hero — fills its absolute parent;
 * reduced-motion freezes the vortex.
 */
export function LandingHeroSpiral({
	posters,
}: {
	posters: readonly LandingHeroPoster[];
}) {
	const [reducedMotion, setReducedMotion] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setReducedMotion(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);

	const images = posters.map((poster) => ({
		// Spiral tiles are ~320 CSS px — w342 is enough and paints sooner than w500.
		src: poster.posterUrl.replace(/\/t\/p\/w500\//, "/t/p/w342/"),
	}));

	return (
		<div className="absolute inset-0 h-full w-full overflow-hidden" aria-hidden>
			<SpiralImages
				images={images}
				speed={reducedMotion ? 0 : 1.05}
				// Bigger tiles; keep coils loose + arc gaps so arms do not collide.
				imageSize={320}
				cornerRadius={10}
				turns={2.7}
				spread={6.6}
				spacing={5.4}
				sizeAttenuation={1.5}
				fadeIn={16}
			/>
		</div>
	);
}
