import { ImageResponse } from "next/og";

import { APP_NAME } from "@/lib/app-brand";
import { fetchJournalPostBySlug } from "@/lib/fetch-journal";
import {
	OG_IMAGE_RESPONSE_SIZE,
	OgBackdropCard,
	OgDefaultCard,
} from "@/lib/og/og-satori-layout";

export const runtime = "edge";

export const revalidate = 86_400;

/** Journal article share card — hero art when available, else branded fallback. */
export async function GET(
	_request: Request,
	context: { params: Promise<{ slug: string }> },
) {
	const { slug } = await context.params;
	const post = await fetchJournalPostBySlug(slug);

	if (post?.heroImageUrl) {
		return new ImageResponse(
			<OgBackdropCard backdropUrl={post.heroImageUrl} variant="title" />,
			OG_IMAGE_RESPONSE_SIZE,
		);
	}

	if (post?.title) {
		return new ImageResponse(
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					width: "100%",
					height: "100%",
					padding: 56,
					background: "#09090a",
					color: "#f2f2f2",
					fontFamily: "system-ui, sans-serif",
				}}
			>
				<div style={{ display: "flex", fontSize: 48, fontWeight: 600 }}>
					{post.title}
				</div>
				<div
					style={{
						display: "flex",
						fontSize: 20,
						color: "#c45c26",
						fontWeight: 600,
					}}
				>
					{APP_NAME}
				</div>
			</div>,
			OG_IMAGE_RESPONSE_SIZE,
		);
	}

	return new ImageResponse(<OgDefaultCard />, OG_IMAGE_RESPONSE_SIZE);
}
