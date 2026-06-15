import type { Metadata } from "next";

import { APP_NAME } from "@/lib/app-brand";

/** Standard OG/Twitter card dimensions. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const OG_DEFAULT_PATH = "/og/default";
export const OG_HOME_PATH = "/og/home";

export function ogTitleMoviePath(id: string | number): string {
	return `/og/title/movie/${id}`;
}

export function ogTitleTvPath(id: string | number): string {
	return `/og/title/tv/${id}`;
}

export function ogTastePath(handle: string): string {
	return `/og/taste/${encodeURIComponent(handle.toLowerCase())}`;
}

export function ogListPath(id: string): string {
	return `/og/list/${encodeURIComponent(id)}`;
}

export function ogJournalPath(slug: string): string {
	return `/og/journal/${encodeURIComponent(slug)}`;
}

export function ogComparePath(viewer: string, target: string): string {
	return `/og/compare/${encodeURIComponent(viewer.toLowerCase())}/${encodeURIComponent(target.toLowerCase())}`;
}

export function ogYearInReviewPath(handle: string, year: number): string {
	return `/og/year/${encodeURIComponent(handle.toLowerCase())}/${year}`;
}

/** Patron-facing share URL — HTML page with compare OG metadata (not the raw image route). */
export function compareSharePath(viewer: string, target: string): string {
	return `/compare/${encodeURIComponent(viewer.toLowerCase())}/${encodeURIComponent(target.toLowerCase())}`;
}

/** Metadata fragment for a generated OG route (resolved via `metadataBase`). */
export function ogImageMetadataFields(
	imagePath: string,
	alt = APP_NAME,
): Pick<Metadata, "openGraph" | "twitter"> {
	return {
		openGraph: {
			images: [
				{
					url: imagePath,
					width: OG_IMAGE_WIDTH,
					height: OG_IMAGE_HEIGHT,
					alt,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			images: [imagePath],
		},
	};
}
