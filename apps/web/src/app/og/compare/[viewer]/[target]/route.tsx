import { ImageResponse } from "next/og";

import { APP_NAME } from "@/lib/app-brand";
import { parseTasteCompareResponse } from "@/lib/sense-taste-overlap";
import { serverApi } from "@/lib/server-api";

export const runtime = "edge";

const flexCol = {
	display: "flex",
	flexDirection: "column" as const,
};

/**
 * Shareable taste comparison card (Sense Tier 1 rivalry loop).
 */
export async function GET(
	_request: Request,
	context: { params: Promise<{ viewer: string; target: string }> },
) {
	const { viewer, target } = await context.params;
	const viewerHandle = viewer.toLowerCase();
	const targetHandle = target.toLowerCase();

	let nameA = viewerHandle;
	let nameB = targetHandle;
	let pct = 0;
	let headline = "Compare your Sense diaries to see how your tastes line up.";
	let shared = 0;

	try {
		const api = await serverApi();
		const res = await api.api.taste.compare.get({
			query: { a: viewerHandle, b: targetHandle },
		});
		const parsed = parseTasteCompareResponse(res.data);
		if (parsed) {
			nameA = parsed.viewer.displayName;
			nameB = parsed.target.displayName;
			pct = parsed.overlap.compatibilityPercent;
			headline = parsed.overlap.framingHeadline;
			shared = parsed.overlap.sharedWatches;
		}
	} catch {
		// Fallback card below.
	}

	const sharedLabel = shared === 1 ? "title" : "titles";

	return new ImageResponse(
		<div
			style={{
				...flexCol,
				justifyContent: "space-between",
				width: "100%",
				height: "100%",
				padding: 56,
				background: "#09090a",
				color: "#f2f2f2",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<div style={{ ...flexCol, gap: 8 }}>
				<div style={{ display: "flex", fontSize: 22, color: "#a1a1aa" }}>
					Taste overlap
				</div>
				<div
					style={{
						display: "flex",
						fontSize: 32,
						fontWeight: 600,
						letterSpacing: "-0.02em",
					}}
				>
					{`${nameA} · ${nameB}`}
				</div>
			</div>
			<div style={{ ...flexCol, gap: 16 }}>
				<div
					style={{
						display: "flex",
						fontSize: 96,
						fontWeight: 700,
						letterSpacing: "-0.04em",
						lineHeight: 1,
					}}
				>
					{`${pct}%`}
				</div>
				<div
					style={{
						display: "flex",
						fontSize: 22,
						lineHeight: 1.45,
						maxWidth: 900,
						color: "#e4e4e7",
					}}
				>
					{headline}
				</div>
				<div style={{ display: "flex", fontSize: 18, color: "#a1a1aa" }}>
					{`${shared} shared ${sharedLabel}`}
				</div>
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
		{ width: 1200, height: 630 },
	);
}
