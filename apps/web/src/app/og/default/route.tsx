import { ImageResponse } from "next/og";

import {
	OG_IMAGE_RESPONSE_SIZE,
	OgDefaultCard,
} from "@/lib/og/og-satori-layout";

export const runtime = "edge";

/** Branded Sense-only OG — global metadata fallback. */
export async function GET() {
	return new ImageResponse(<OgDefaultCard />, OG_IMAGE_RESPONSE_SIZE);
}
