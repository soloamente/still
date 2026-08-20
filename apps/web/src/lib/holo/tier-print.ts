import type { PlanTierId } from "@still/plans";

import { type Foil, foilByKey } from "./engine";

export interface SubscriptionHoloAppearance {
	foil: Foil;
	bodyGrad: string;
	tileDark: string;
	tileLight: string;
}

/** Pale prints — high value, low chroma so color-dodge foil stays readable. */
const PRINT: Record<PlanTierId, { body: string[]; tile: [string, string] }> = {
	still: {
		body: ["#e8eef4", "#dfe6ee", "#d5dde8", "#e2e8f0"],
		tile: ["#3d4a5c", "#e2e8f0"],
	},
	attuned: {
		body: ["#f3ebe0", "#eadcc8", "#e0d0b8", "#efe4d4"],
		tile: ["#6b4e32", "#efe4d4"],
	},
	immersed: {
		body: ["#f2ecd8", "#e8dfc4", "#ddd2b0", "#efe8d4"],
		tile: ["#5c4a28", "#efe8d4"],
	},
	devoted: {
		body: ["#f4e4ee", "#ebd4e4", "#e0c4d8", "#f0dceb"],
		tile: ["#6b3a58", "#f0dceb"],
	},
};

const FOIL_KEY: Record<PlanTierId, string> = {
	still: "brushed",
	attuned: "holo",
	immersed: "velvet",
	devoted: "cosmos",
};

export function subscriptionHoloAppearance(
	tier: PlanTierId,
): SubscriptionHoloAppearance {
	const print = PRINT[tier];
	return {
		foil: foilByKey(FOIL_KEY[tier]),
		bodyGrad: `linear-gradient(115deg, ${print.body.join(", ")})`,
		tileDark: print.tile[0],
		tileLight: print.tile[1],
	};
}
