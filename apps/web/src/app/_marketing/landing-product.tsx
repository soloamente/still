"use client";

import { useEffect, useState } from "react";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";

import {
	LANDING_CHAPTER_COPY,
	LANDING_CHAPTERS,
	LANDING_PRODUCT_HEADING,
	type LandingProductTabId,
} from "./landing-copy";
import {
	LandingFeatureQuickLogVisual,
	LandingFeatureRanksVisual,
} from "./landing-feature-visuals";
import {
	LANDING_CHAPTER_CARD_CLASS,
	LANDING_CHAPTER_WELL_CLASS,
	LANDING_FEATURES_SECTION_TITLE_CLASS,
} from "./landing-mobbin-hero";
import { LandingTasteVisual } from "./landing-taste-visual";

function isLandingProductTabId(value: string): value is LandingProductTabId {
	return value === "taste" || value === "diary" || value === "community";
}

function LandingProductSpecimen({ tab }: { tab: LandingProductTabId }) {
	switch (tab) {
		case "taste":
			return <LandingTasteVisual />;
		case "diary":
			return <LandingFeatureQuickLogVisual />;
		case "community":
			return <LandingFeatureRanksVisual />;
		default: {
			// Exhaustive never — new tab ids must fail compile before shipping.
			const _never: never = tab;
			return _never;
		}
	}
}

// Client component: tab selection is local UI state; hash deep-links from the
// floating nav (Taste · Diary · Community) sync the active specimen.
export function LandingProduct() {
	const [tab, setTab] = useState<LandingProductTabId>("taste");

	useEffect(() => {
		const applyHash = () => {
			const id = window.location.hash.replace(/^#/, "");
			if (isLandingProductTabId(id)) {
				setTab(id);
			}
		};
		applyHash();
		window.addEventListener("hashchange", applyHash);
		return () => window.removeEventListener("hashchange", applyHash);
	}, []);

	return (
		<section
			id="product"
			className="relative scroll-mt-28 px-4 py-16 sm:px-6 sm:py-24"
		>
			{/* Static anchors so nav hashes land on this band for every chapter. */}
			<div
				id="taste"
				className="pointer-events-none absolute top-0"
				aria-hidden
			/>
			<div
				id="diary"
				className="pointer-events-none absolute top-0"
				aria-hidden
			/>
			<div
				id="community"
				className="pointer-events-none absolute top-0"
				aria-hidden
			/>
			<div className="mx-auto flex w-full max-w-mobbin-page flex-col items-center">
				<h2 className={LANDING_FEATURES_SECTION_TITLE_CLASS}>
					{LANDING_PRODUCT_HEADING}
				</h2>
				<div className="mt-8">
					<SegmentedPillToolbar
						layoutId="landing-product-tab"
						aria-label="How Sense works"
						value={tab}
						onChange={(next) => {
							setTab(next);
							// Keep the URL hash aligned with the specimen for share/back.
							window.history.replaceState(null, "", `#${next}`);
						}}
						options={LANDING_CHAPTERS}
					/>
				</div>
				<p className="mt-6 max-w-md text-pretty text-center font-sans text-muted-foreground text-sm leading-relaxed sm:text-base">
					{LANDING_CHAPTER_COPY[tab].body}
				</p>
				<div className={`mt-10 w-full ${LANDING_CHAPTER_CARD_CLASS}`}>
					<div className={LANDING_CHAPTER_WELL_CLASS}>
						<LandingProductSpecimen tab={tab} />
					</div>
				</div>
			</div>
		</section>
	);
}
