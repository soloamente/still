import type { AvatarAuraFrameKind } from "./avatar-aura-tier";

export const AVATAR_AURA_FRAME_VIEWBOX = 100;
/** Photo well inset inside the scallop mask (percent of the aura root). */
export const AVATAR_AURA_WELL_INSET_PERCENT = 14;
/**
 * Scale the layout box when a frame is present so the photo well stays the
 * intended portrait size (rim grows outward instead of eating the face).
 */
export const AVATAR_AURA_OUTER_SCALE =
	100 / (100 - 2 * AVATAR_AURA_WELL_INSET_PERCENT);

const CX = 50;
const CY = 50;

type PolarLobe = {
	frequency: number;
	baseRadius: number;
	amplitude: number;
	/** 1 = round cosine lobes; higher = squarer staff petals. */
	sharpness?: number;
};

function polarLobePath(lobe: PolarLobe): string {
	const samples = lobe.frequency * 12;
	const sharpness = lobe.sharpness ?? 1;
	const parts: string[] = [];
	for (let i = 0; i <= samples; i++) {
		const t = (i / samples) * Math.PI * 2;
		const wave = Math.cos(lobe.frequency * t);
		const shaped =
			sharpness === 1
				? wave
				: Math.sign(wave) * Math.abs(wave) ** (1 / sharpness);
		const r = lobe.baseRadius + lobe.amplitude * shaped;
		const x = CX + r * Math.cos(t - Math.PI / 2);
		const y = CY + r * Math.sin(t - Math.PI / 2);
		parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(3)} ${y.toFixed(3)}`);
	}
	return `${parts.join(" ")} Z`;
}

export function avatarAuraFramePaths(kind: AvatarAuraFrameKind): {
	inner: string;
	outer: string | null;
} {
	switch (kind) {
		case "attuned":
			return {
				inner: polarLobePath({ frequency: 8, baseRadius: 38, amplitude: 8 }),
				outer: null,
			};
		case "immersed":
			return {
				inner: polarLobePath({ frequency: 16, baseRadius: 39, amplitude: 5 }),
				outer: null,
			};
		case "devoted":
			return {
				inner: polarLobePath({ frequency: 16, baseRadius: 36, amplitude: 5 }),
				outer: polarLobePath({ frequency: 8, baseRadius: 42, amplitude: 4 }),
			};
		case "staff":
			return {
				inner: polarLobePath({
					frequency: 8,
					baseRadius: 38,
					amplitude: 7,
					sharpness: 2.4,
				}),
				outer: null,
			};
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

export function avatarAuraFrameMaskSvg(kind: AvatarAuraFrameKind): string {
	const { inner, outer } = avatarAuraFramePaths(kind);
	const outerEl = outer ? `<path d="${outer}" fill="white"/>` : "";
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AVATAR_AURA_FRAME_VIEWBOX} ${AVATAR_AURA_FRAME_VIEWBOX}">${outerEl}<path d="${inner}" fill="white"/></svg>`;
}

export function avatarAuraFrameMaskStyle(kind: AvatarAuraFrameKind): {
	"--avatar-aura-frame-mask": string;
} {
	const uri = `url("data:image/svg+xml,${encodeURIComponent(avatarAuraFrameMaskSvg(kind))}")`;
	return { "--avatar-aura-frame-mask": uri };
}
