import { ImageResponse } from "next/og";

import { fetchOgHomeBackdropUrl } from "@/lib/og/fetch-og-backdrops";
import {
	OG_IMAGE_RESPONSE_SIZE,
	OgBackdropCard,
	OgDefaultCard,
} from "@/lib/og/og-satori-layout";

export const runtime = "edge";

/** Refresh when the popular catalogue shifts. */
export const revalidate = 3600;

/** Home + landing OG — popular #1 backdrop with Sense wordmark. */
export async function GET() {
	const backdropUrl = await fetchOgHomeBackdropUrl();

	if (backdropUrl) {
		return new ImageResponse(
			<OgBackdropCard backdropUrl={backdropUrl} variant="home" />,
			OG_IMAGE_RESPONSE_SIZE,
		);
	}

	return new ImageResponse(<OgDefaultCard />, OG_IMAGE_RESPONSE_SIZE);
}
