import { APP_NAME } from "@/lib/app-brand";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/og/og-image-metadata";

/** Satori requires `display: flex` on containers with multiple children. */
const flex = { display: "flex" as const };

const OG_ACCENT = "#c45c26";
const OG_CANVAS = "#09090a";

export const OG_IMAGE_RESPONSE_SIZE = {
	width: OG_IMAGE_WIDTH,
	height: OG_IMAGE_HEIGHT,
};

/** Sense-only fallback — home API miss and global default. */
export function OgDefaultCard() {
	return (
		<div
			style={{
				...flex,
				alignItems: "center",
				justifyContent: "center",
				width: "100%",
				height: "100%",
				background: OG_CANVAS,
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<div
				style={{
					...flex,
					fontSize: 96,
					fontWeight: 600,
					letterSpacing: "-0.03em",
					color: OG_ACCENT,
				}}
			>
				{APP_NAME}
			</div>
		</div>
	);
}

type OgBackdropCardProps = {
	backdropUrl: string;
	/** Home uses a large centered mark; title pages use a small corner mark. */
	variant: "home" | "title";
};

/** Full-bleed listing art with minimal Sense branding. */
export function OgBackdropCard({ backdropUrl, variant }: OgBackdropCardProps) {
	const isHome = variant === "home";

	return (
		<div
			style={{
				...flex,
				position: "relative",
				width: "100%",
				height: "100%",
				background: OG_CANVAS,
				fontFamily: "system-ui, sans-serif",
			}}
		>
			{/* biome-ignore lint/performance/noImgElement: Satori OG renderer requires a plain <img> for remote backdrops */}
			<img
				alt=""
				src={backdropUrl}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					objectFit: "cover",
				}}
			/>
			<div
				style={{
					...flex,
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					height: isHome ? "55%" : "38%",
					background:
						"linear-gradient(to top, rgba(9, 9, 10, 0.92) 0%, rgba(9, 9, 10, 0.45) 55%, rgba(9, 9, 10, 0) 100%)",
				}}
			/>
			<div
				style={{
					...flex,
					position: "absolute",
					...(isHome
						? {
								bottom: 56,
								left: 0,
								right: 0,
								justifyContent: "center",
							}
						: {
								bottom: 44,
								right: 48,
							}),
				}}
			>
				<div
					style={{
						...flex,
						fontSize: isHome ? 88 : 44,
						fontWeight: 600,
						letterSpacing: "-0.03em",
						color: OG_ACCENT,
					}}
				>
					{APP_NAME}
				</div>
			</div>
		</div>
	);
}
