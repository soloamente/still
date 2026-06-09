import { ImageResponse } from "next/og";

import { fetchOgListCoverUrl } from "@/lib/og/fetch-og-list-cover";
import {
	OG_IMAGE_RESPONSE_SIZE,
	OgBackdropCard,
	OgDefaultCard,
} from "@/lib/og/og-satori-layout";

export const runtime = "edge";

export const revalidate = 86_400;

/** Public list share card — cover art + corner Sense mark. */
export async function GET(
	_request: Request,
	context: { params: Promise<{ id: string }> },
) {
	const { id } = await context.params;
	const coverUrl = await fetchOgListCoverUrl(id);

	if (coverUrl) {
		return new ImageResponse(
			<OgBackdropCard backdropUrl={coverUrl} variant="title" />,
			OG_IMAGE_RESPONSE_SIZE,
		);
	}

	return new ImageResponse(<OgDefaultCard />, OG_IMAGE_RESPONSE_SIZE);
}
