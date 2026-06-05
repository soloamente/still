import { ImageResponse } from "next/og";

import { APP_NAME } from "@/lib/app-brand";
import {
	parseTasteSignatureJson,
	resolveTasteHeadline,
} from "@/lib/sense-taste-signature";
import { serverApi } from "@/lib/server-api";

export const runtime = "edge";

/** Satori requires `display: flex` on any element with multiple children (including whitespace). */
const flexCol = {
	display: "flex",
	flexDirection: "column" as const,
};

/**
 * Shareable taste card (Sense Tier 0) — OG image for profile links.
 */
export async function GET(
	_request: Request,
	context: { params: Promise<{ handle: string }> },
) {
	const { handle } = await context.params;
	const normalized = handle.toLowerCase();

	let displayName = `@${normalized}`;
	let headline = "Taste map still forming — log a few films on Sense to begin.";

	try {
		const api = await serverApi();
		const res = await api.api.profiles({ handle: normalized }).get();
		const data = res.data as {
			profile?: { displayName?: string; tasteSignature?: unknown };
			user?: { name?: string | null };
		} | null;

		displayName =
			data?.profile?.displayName ?? data?.user?.name ?? `@${normalized}`;
		const taste = parseTasteSignatureJson(data?.profile?.tasteSignature);
		const resolved = resolveTasteHeadline(taste, "visitor");
		if (resolved) headline = resolved;
	} catch {
		// Also render a branded fallback card when the API is unreachable.
	}

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
			<div style={{ ...flexCol, gap: 12 }}>
				<div
					style={{
						display: "flex",
						fontSize: 28,
						fontWeight: 600,
						letterSpacing: "-0.02em",
					}}
				>
					{displayName}
				</div>
				<div style={{ display: "flex", fontSize: 18, color: "#a1a1aa" }}>
					{`@${normalized}`}
				</div>
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
