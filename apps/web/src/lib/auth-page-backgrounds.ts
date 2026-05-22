/**
 * TMDB backdrop stills for the auth carousel — paths verified against `w1280` CDN.
 * Curated from popular titles so the pool is large and URLs stay valid.
 */
export const AUTH_PAGE_BACKDROP_PATHS = [
	"/qO55CD8tgVL1T4WKn6zYFFiD6lL.jpg",
	"/2I1OFQJ0L9T0dpU6FobKFWV2PxX.jpg",
	"/wMrV8SLne1jHLeYS0lLrA1Tf86P.jpg",
	"/9Z2uDYXqJrlmePznQQJhL6d92Rq.jpg",
	"/zMwhWailP1WY7sb6AoE6b8ugoy.jpg",
	"/gkh6Nt8DtY1XT4gQsyFq9XAVJlJ.jpg",
	"/1x9e0qWonw634NhIsRdvnneeqvN.jpg",
	"/oTE4lNs4PSG5iIWjqaTdCIFJ4Bs.jpg",
	"/1pKFDggvtk23zcn1vUcPiKyuHxM.jpg",
	"/6ELCZlTA5lGUops70hKdB83WJxH.jpg",
	"/iN41Ccw4DctL8npfmYg1j5Tr1eb.jpg",
	"/4EAAwpylq313qrDqpCxulUrXBNF.jpg",
	"/hdLsZ3dCjKt5A6xDpoo3UFgcTSm.jpg",
	"/hlZGaey4lR9hc4rGxZRAmIEsZOc.jpg",
	"/jAJYVbVR5fP0BeTQXRP1BXjW5bl.jpg",
	"/xA6AM5MvEkieZKlv1Tn3sN23I7i.jpg",
	"/8zLS8p1tRyWFLRFfmgQq0j5WE6z.jpg",
	"/69KkxROnZoJdQAulnY5B7Gx6D7Z.jpg",
	"/u53UYu5XG2hNgWGvs3xGhAVzypl.jpg",
	"/8qkDwjTFoLAwmYh2J9HMeIDRlxd.jpg",
	"/9dMp9t0d0nIGhiil8TyqChwiNwA.jpg",
	"/xBT0oNq6rsTFv4SxG5uGRIEOrq6.jpg",
	"/4BtL2vvEufDXDP4u6xQjjQ1Y2aT.jpg",
	"/tq3h43fZy0H80vzf47MAY7R9Mxo.jpg",
	"/zfbjgQE1uSd9wiPTX4VzsLi0rGG.jpg",
	"/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg",
	"/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg",
] as const;

/** Backdrop width — `w1280` is sharp enough for auth and loads faster than `original`. */
export const AUTH_BACKDROP_TMDB_SIZE = "w1280" as const;

export function authBackdropUrl(path: string): string {
	return `https://image.tmdb.org/t/p/${AUTH_BACKDROP_TMDB_SIZE}${path}`;
}

/** @deprecated Use `AUTH_PAGE_BACKDROP_PATHS` + `authBackdropUrl`. */
export const AUTH_PAGE_BACKGROUNDS = AUTH_PAGE_BACKDROP_PATHS.map((path) =>
	authBackdropUrl(path),
);

/** How long each still stays up before the next cross-fade begins (~33s fully visible). */
export const AUTH_BACKGROUND_INTERVAL_MS = 35_000;

/** Cross-fade length — shorter than the hold so the image reads before it dissolves. */
export const AUTH_BACKGROUND_CROSSFADE_MS = 2_000;

/** Outgoing slide blur during cross-fade (incoming resolves to 0). */
export const AUTH_BACKGROUND_CROSSFADE_BLUR_PX = 5;
