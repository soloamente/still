import { ImageResponse } from "next/og";

import { APP_NAME } from "@/lib/app-brand";
import { fetchYearInReviewForHandleServer } from "@/lib/fetch-year-in-review-server";
import {
	OG_IMAGE_RESPONSE_SIZE,
	OgDefaultCard,
} from "@/lib/og/og-satori-layout";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import {
	formatYearInReviewAverageRating,
	formatYearInReviewDecade,
	parseYearInReviewYearParam,
} from "@/lib/year-in-review-display";

export const runtime = "edge";

const flexCol = {
	display: "flex",
	flexDirection: "column" as const,
};

/** Wrapped share card — avatar, headline stats, top poster thumbs. */
export async function GET(
	request: Request,
	context: { params: Promise<{ handle: string; year: string }> },
) {
	const { handle, year: yearRaw } = await context.params;
	const normalized = handle.toLowerCase();
	const year = parseYearInReviewYearParam(yearRaw);
	if (year == null) {
		return new ImageResponse(<OgDefaultCard />, OG_IMAGE_RESPONSE_SIZE);
	}

	const payload = await fetchYearInReviewForHandleServer(normalized, year);
	if (!payload?.eligible) {
		return new ImageResponse(<OgDefaultCard />, OG_IMAGE_RESPONSE_SIZE);
	}

	const origin = new URL(request.url).origin;
	const avatarUrl = `${origin}/api/profiles/avatar/${encodeURIComponent(normalized)}`;
	const avg = formatYearInReviewAverageRating(payload.averageRating);
	const decade = formatYearInReviewDecade(payload.topDecade);
	const posterUrls = payload.topTitles
		.slice(0, 3)
		.map((title) => tmdbPosterUrlFromPath(title.posterPath, "w342"))
		.filter((url): url is string => Boolean(url));

	const statLine = [
		`${payload.totalLogs} watches`,
		avg ? `${avg} avg` : null,
		`${payload.reviewCount} reviews`,
	]
		.filter(Boolean)
		.join(" · ");

	const decadeLine = decade ? `Top decade · ${decade}` : null;

	return new ImageResponse(
		<div
			style={{
				...flexCol,
				width: "100%",
				height: "100%",
				padding: 48,
				background: "#09090a",
				color: "#f2f2f2",
				fontFamily: "system-ui, sans-serif",
				justifyContent: "space-between",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 20 }}>
				{/* biome-ignore lint/performance/noImgElement: Satori requires plain img for remote avatars */}
				<img
					alt=""
					src={avatarUrl}
					width={72}
					height={72}
					style={{
						borderRadius: 999,
						objectFit: "cover",
						border: "2px solid rgba(255,255,255,0.12)",
					}}
				/>
				<div style={{ ...flexCol, gap: 6 }}>
					<div style={{ display: "flex", fontSize: 28, fontWeight: 600 }}>
						{`${year} in film`}
					</div>
					<div style={{ display: "flex", fontSize: 18, color: "#a1a1aa" }}>
						{`@${normalized}`}
					</div>
				</div>
			</div>

			<div style={{ ...flexCol, gap: 12, maxWidth: 720 }}>
				<div style={{ display: "flex", fontSize: 24, lineHeight: 1.35 }}>
					{statLine}
				</div>
				{decadeLine ? (
					<div style={{ display: "flex", fontSize: 18, color: "#d4d4d8" }}>
						{decadeLine}
					</div>
				) : null}
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "flex-end",
					justifyContent: "space-between",
					gap: 16,
				}}
			>
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
				<div style={{ display: "flex", gap: 12 }}>
					{posterUrls.map((url) => (
						// biome-ignore lint/performance/noImgElement: Satori poster thumbs
						<img
							key={url}
							alt=""
							src={url}
							width={88}
							height={132}
							style={{
								borderRadius: 12,
								objectFit: "cover",
							}}
						/>
					))}
				</div>
			</div>
		</div>,
		OG_IMAGE_RESPONSE_SIZE,
	);
}
