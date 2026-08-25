"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import SpiralImages from "@/components/originkit/ui/spiralimages";
import {
	LANDING_HERO_SPIRAL_IMAGE_SIZE_MAX,
	LANDING_HERO_SPIRAL_SPACING_DESKTOP,
	LANDING_HERO_SPIRAL_TURNS_DESKTOP,
	landingHeroSpiralLayout,
} from "./landing-hero-spiral-layout";
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
	// SSR + first client render match (320). useLayoutEffect sizes before paint
	// so Agentation / phones never flash desktop tiles.
	const [imageSize, setImageSize] = useState(
		LANDING_HERO_SPIRAL_IMAGE_SIZE_MAX,
	);
	const [spacing, setSpacing] = useState(LANDING_HERO_SPIRAL_SPACING_DESKTOP);
	const [turns, setTurns] = useState(LANDING_HERO_SPIRAL_TURNS_DESKTOP);
	const shellRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setReducedMotion(mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);

	// Canvas tiles are absolute px — recompute when the hero band resizes.
	useLayoutEffect(() => {
		const el = shellRef.current;
		if (!el) return;
		const apply = () => {
			const next = landingHeroSpiralLayout(
				Math.min(el.clientWidth, el.clientHeight),
			);
			setImageSize((prev) => (prev === next.imageSize ? prev : next.imageSize));
			setSpacing((prev) => (prev === next.spacing ? prev : next.spacing));
			setTurns((prev) => (prev === next.turns ? prev : next.turns));
		};
		apply();
		const observer = new ResizeObserver(apply);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const images = posters.map((poster) => ({
		// Tile CSS size follows `landingHeroSpiralLayout`; w342 still covers desktop 320px.
		src: poster.posterUrl.replace(/\/t\/p\/w500\//, "/t/p/w342/"),
	}));

	return (
		<div
			ref={shellRef}
			className="absolute inset-0 h-full w-full overflow-hidden"
			aria-hidden
		>
			<SpiralImages
				images={images}
				speed={reducedMotion ? 0 : 1.05}
				// Size/spacing/turns come from the band min-edge so phone coils stay apart.
				imageSize={imageSize}
				cornerRadius={10}
				turns={turns}
				spread={6.6}
				spacing={spacing}
				sizeAttenuation={1.5}
				fadeIn={16}
			/>
		</div>
	);
}
