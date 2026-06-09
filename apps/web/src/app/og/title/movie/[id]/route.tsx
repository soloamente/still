import { ImageResponse } from "next/og";

import { fetchOgMovieBackdropUrl } from "@/lib/og/fetch-og-backdrops";
import {
	OG_IMAGE_RESPONSE_SIZE,
	OgBackdropCard,
	OgDefaultCard,
} from "@/lib/og/og-satori-layout";

export const runtime = "edge";

export const revalidate = 86_400;

/** Film detail share card — backdrop + corner Sense mark. */
export async function GET(
	_request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const { id } = await context.params;
	const backdropUrl = await fetchOgMovieBackdropUrl(id);

	if (backdropUrl) {
		return new ImageResponse(
			<OgBackdropCard backdropUrl={backdropUrl} variant="title" />,
			OG_IMAGE_RESPONSE_SIZE,
		);
	}

	return new ImageResponse(<OgDefaultCard />, OG_IMAGE_RESPONSE_SIZE);
}
