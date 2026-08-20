// Holo — the maths and the materials behind an identity card that catches the
// light.
//
// Four ideas carry the whole thing.
//
//   ONE INPUT SHAPE. Pointer and device orientation are completely different
//   signals, so both are normalised to the same { x, y } in -1..1 before
//   anything reads them. Everything downstream — tilt, foil position, glare,
//   sheen — derives from that one pair, which is why swapping input sources
//   needs no other change.
//
//   THE FOIL LAGS THE CARD. Real laminate has mass: the surface catches up to
//   the card rather than moving with it. Two followers at different stiffnesses
//   is what turns a gradient that tracks a cursor into a material.
//
//   THE PRINT IS FIXED PER CARD. Sense paints a pale tier-tinted body under the
//   foil (via applyFoil opts); only the laminate above it changes. A preset that
//   re-prints the card is a different card; a preset that changes the foil is
//   the same card under a different laminate, which is the thing being demonstrated.
//
//   MATERIALS ARE DATA, NOT CSS. Every material is three generic layers whose
//   entire paint — image, scale, position rate, blend, filter, opacity curve —
//   comes from custom properties. The stylesheet never knows which material is
//   mounted, so adding a material is adding an object to the array below.

/** A normalised pointer/tilt reading. (0,0) is dead centre, (1,1) bottom-right. */
export interface Vec {
	x: number;
	y: number;
}

/* ── Tiles ──────────────────────────────────────────────────────────────────
 *
 * Inline SVG rather than files: small, no extra requests, and they cannot 404.
 * Three tiles are the entire asset budget for all ten materials; everything
 * else is gradients.
 */

/** Scattered 4-point sparkles. Drawn TWICE per material at slightly different
 *  offsets: one copy is a static field, two copies beating against each other
 *  is what twinkles. */
const GLITTER = `url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27100%27%20height%3D%27100%27%20fill%3D%27%23fff%27%3E%3Cpath%20d%3D%27M34%2015.3L35.7%2019L34%2023.3L33.3%2019Z%27%20opacity%3D%270.54%27%20transform%3D%27rotate%2848%2034%2019%29%27%2F%3E%3Cpath%20d%3D%27M38%207.5L39.3%2011L38%2014.7L37.1%2011Z%27%20opacity%3D%270.52%27%20transform%3D%27rotate%2839%2038%2011%29%27%2F%3E%3Cpath%20d%3D%27M12%2010.6L13.2%2014L12%2017.4L11.1%2014Z%27%20opacity%3D%270.91%27%20transform%3D%27rotate%2811%2012%2014%29%27%2F%3E%3Cpath%20d%3D%27M26%2056.4L27.1%2061L26%2066.1L24.2%2061Z%27%20opacity%3D%270.79%27%20transform%3D%27rotate%2836%2026%2061%29%27%2F%3E%3Cpath%20d%3D%27M92%205.5L93.3%2010L92%2014.7L90.5%2010Z%27%20opacity%3D%270.64%27%20transform%3D%27rotate%2813%2092%2010%29%27%2F%3E%3Cpath%20d%3D%27M16%2028.7L17.7%2033L16%2037.6L15.0%2033Z%27%20opacity%3D%270.59%27%20transform%3D%27rotate%2852%2016%2033%29%27%2F%3E%3Cpath%20d%3D%27M62%2035.0L63.3%2039L62%2042.5L61.1%2039Z%27%20opacity%3D%270.53%27%20transform%3D%27rotate%285%2062%2039%29%27%2F%3E%3Cpath%20d%3D%27M24%2062.5L25.1%2066L24%2069.3L23.1%2066Z%27%20opacity%3D%270.66%27%20transform%3D%27rotate%2853%2024%2066%29%27%2F%3E%3Cpath%20d%3D%27M46%2028.0L47.2%2032L46%2036.8L44.6%2032Z%27%20opacity%3D%270.85%27%20transform%3D%27rotate%2822%2046%2032%29%27%2F%3E%3Cpath%20d%3D%27M57%2047.6L57.9%2052L57%2056.9L55.2%2052Z%27%20opacity%3D%270.86%27%20transform%3D%27rotate%2826%2057%2052%29%27%2F%3E%3Cpath%20d%3D%27M92%2013.0L93.3%2016L92%2019.8L91.2%2016Z%27%20opacity%3D%270.88%27%20transform%3D%27rotate%2814%2092%2016%29%27%2F%3E%3Cpath%20d%3D%27M49%205.4L50.3%209L49%2013.5L47.8%209Z%27%20opacity%3D%270.88%27%20transform%3D%27rotate%2852%2049%209%29%27%2F%3E%3Cpath%20d%3D%27M83%2029.5L84.3%2034L83%2037.8L81.8%2034Z%27%20opacity%3D%270.80%27%20transform%3D%27rotate%2852%2083%2034%29%27%2F%3E%3Cpath%20d%3D%27M46%2075.1L47.6%2080L46%2084.8L44.7%2080Z%27%20opacity%3D%270.74%27%20transform%3D%27rotate%2860%2046%2080%29%27%2F%3E%3C%2Fsvg%3E")`;
/** A dense star field for the deep-space materials. */
const STARS = `url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27100%27%20height%3D%27100%27%20fill%3D%27%23fff%27%3E%3Ccircle%20cx%3D%2768%27%20cy%3D%2778%27%20r%3D%270.6%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2739%27%20cy%3D%27100%27%20r%3D%270.4%27%20opacity%3D%270.4%27%2F%3E%3Ccircle%20cx%3D%2726%27%20cy%3D%2726%27%20r%3D%270.5%27%20opacity%3D%270.5%27%2F%3E%3Ccircle%20cx%3D%2711%27%20cy%3D%2733%27%20r%3D%270.5%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2720%27%20cy%3D%277%27%20r%3D%270.4%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2739%27%20cy%3D%2773%27%20r%3D%270.7%27%20opacity%3D%270.5%27%2F%3E%3Ccircle%20cx%3D%2710%27%20cy%3D%2773%27%20r%3D%270.7%27%20opacity%3D%270.5%27%2F%3E%3Ccircle%20cx%3D%2766%27%20cy%3D%2730%27%20r%3D%270.8%27%20opacity%3D%270.8%27%2F%3E%3Ccircle%20cx%3D%2779%27%20cy%3D%2795%27%20r%3D%270.4%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2773%27%20cy%3D%2780%27%20r%3D%270.5%27%20opacity%3D%270.4%27%2F%3E%3Ccircle%20cx%3D%2763%27%20cy%3D%2710%27%20r%3D%270.7%27%20opacity%3D%270.3%27%2F%3E%3Ccircle%20cx%3D%2745%27%20cy%3D%2748%27%20r%3D%270.4%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2750%27%20cy%3D%2737%27%20r%3D%270.7%27%20opacity%3D%270.8%27%2F%3E%3Ccircle%20cx%3D%2789%27%20cy%3D%2724%27%20r%3D%270.3%27%20opacity%3D%270.5%27%2F%3E%3Ccircle%20cx%3D%2711%27%20cy%3D%2771%27%20r%3D%270.4%27%20opacity%3D%270.4%27%2F%3E%3Ccircle%20cx%3D%2728%27%20cy%3D%2740%27%20r%3D%270.7%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2730%27%20cy%3D%2768%27%20r%3D%270.3%27%20opacity%3D%270.4%27%2F%3E%3Ccircle%20cx%3D%2769%27%20cy%3D%2775%27%20r%3D%270.4%27%20opacity%3D%270.3%27%2F%3E%3Ccircle%20cx%3D%2751%27%20cy%3D%2766%27%20r%3D%270.3%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2727%27%20cy%3D%279%27%20r%3D%270.4%27%20opacity%3D%270.5%27%2F%3E%3Ccircle%20cx%3D%2747%27%20cy%3D%2711%27%20r%3D%270.6%27%20opacity%3D%270.8%27%2F%3E%3Ccircle%20cx%3D%2768%27%20cy%3D%277%27%20r%3D%270.6%27%20opacity%3D%270.7%27%2F%3E%3Ccircle%20cx%3D%271%27%20cy%3D%2738%27%20r%3D%270.6%27%20opacity%3D%270.9%27%2F%3E%3Ccircle%20cx%3D%2793%27%20cy%3D%2757%27%20r%3D%270.6%27%20opacity%3D%270.9%27%2F%3E%3Ccircle%20cx%3D%2721%27%20cy%3D%2751%27%20r%3D%270.3%27%20opacity%3D%270.8%27%2F%3E%3Ccircle%20cx%3D%2765%27%20cy%3D%2721%27%20r%3D%270.4%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2775%27%20cy%3D%2714%27%20r%3D%270.5%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2726%27%20cy%3D%2788%27%20r%3D%270.7%27%20opacity%3D%270.9%27%2F%3E%3Ccircle%20cx%3D%2764%27%20cy%3D%2768%27%20r%3D%270.4%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2743%27%20cy%3D%2748%27%20r%3D%270.3%27%20opacity%3D%270.8%27%2F%3E%3Ccircle%20cx%3D%2715%27%20cy%3D%2746%27%20r%3D%270.8%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2787%27%20cy%3D%2726%27%20r%3D%270.5%27%20opacity%3D%270.5%27%2F%3E%3Ccircle%20cx%3D%2732%27%20cy%3D%2737%27%20r%3D%270.5%27%20opacity%3D%270.8%27%2F%3E%3Ccircle%20cx%3D%2797%27%20cy%3D%279%27%20r%3D%270.6%27%20opacity%3D%270.6%27%2F%3E%3Ccircle%20cx%3D%2741%27%20cy%3D%274%27%20r%3D%270.5%27%20opacity%3D%270.5%27%2F%3E%3Ccircle%20cx%3D%2737%27%20cy%3D%2759%27%20r%3D%270.5%27%20opacity%3D%270.5%27%2F%3E%3Ccircle%20cx%3D%2727%27%20cy%3D%2798%27%20r%3D%270.5%27%20opacity%3D%270.9%27%2F%3E%3Ccircle%20cx%3D%2717%27%20cy%3D%2766%27%20r%3D%270.6%27%20opacity%3D%270.7%27%2F%3E%3Ccircle%20cx%3D%2751%27%20cy%3D%2787%27%20r%3D%271.6%27%20opacity%3D%27.95%27%2F%3E%3Ccircle%20cx%3D%275%27%20cy%3D%2768%27%20r%3D%271.6%27%20opacity%3D%27.95%27%2F%3E%3Ccircle%20cx%3D%2725%27%20cy%3D%2773%27%20r%3D%271.8%27%20opacity%3D%27.95%27%2F%3E%3Ccircle%20cx%3D%2728%27%20cy%3D%2715%27%20r%3D%271.4%27%20opacity%3D%27.95%27%2F%3E%3Ccircle%20cx%3D%2759%27%20cy%3D%2744%27%20r%3D%271.3%27%20opacity%3D%27.95%27%2F%3E%3Ccircle%20cx%3D%2745%27%20cy%3D%2755%27%20r%3D%271.6%27%20opacity%3D%27.95%27%2F%3E%3C%2Fsvg%3E")`;
/** Fine monochrome noise, used to break up the flatter materials so they read
 *  as a printed surface rather than a clean gradient. */
const GRAIN = `url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%27120%27%20height%3D%27120%27%3E%3Cfilter%20id%3D%27n%27%3E%3CfeTurbulence%20type%3D%27fractalNoise%27%20baseFrequency%3D%27.85%27%20numOctaves%3D%273%27%20stitchTiles%3D%27stitch%27%2F%3E%3CfeColorMatrix%20type%3D%27saturate%27%20values%3D%270%27%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%27120%27%20height%3D%27120%27%20filter%3D%27url%28%23n%29%27%20opacity%3D%27.4%27%2F%3E%3C%2Fsvg%3E")`;

/** The six spectral hues the foil runs through. High value, high saturation:
 *  each layer's filter crushes them hard, so starting from anything muted
 *  leaves nothing to crush. */
export const SUNPILLARS = [
	"hsl(2, 100%, 73%)",
	"hsl(53, 100%, 69%)",
	"hsl(93, 100%, 69%)",
	"hsl(176, 100%, 76%)",
	"hsl(228, 100%, 74%)",
	"hsl(283, 100%, 73%)",
];

const S = SUNPILLARS;

/** A repeating spectral ramp at a given angle and pitch. The workhorse: most
 *  materials are this plus one or two other layers. */
function rainbow(angle: string, space: string, hues: string[] = S): string {
	const stops = hues
		.map((c, i) => `${c} calc(${space} * ${i + 1})`)
		.concat(`${hues[0]} calc(${space} * ${hues.length + 1})`)
		.join(", ");
	return `repeating-linear-gradient(${angle}, ${stops})`;
}

/**
 * ONE LAYER of a material.
 *
 * The fields map one-to-one onto CSS properties, and the reason they are all
 * exposed is that materials differ almost entirely in these numbers rather
 * than in structure — one stacks images at 1100%, 600% and 200% in a single
 * layer, another fades one layer OUT as a second fades in. Fixing any of them
 * in the stylesheet would collapse ten materials into one with different
 * colours.
 */
export interface Layer {
	/** One or more background images, comma-joined, painted back-to-front. */
	img: string;
	/** background-size. Mismatched scales across layers is what gives depth —
	 *  layers at different scales move at different apparent rates. */
	size: string;
	/**
	 * How fast this layer slides per unit of tilt, as a multiplier on the
	 * pointer's own travel. NEGATIVE runs it against the pointer, which is how
	 * two layers of the same material come apart as the card turns.
	 */
	rate: number;
	/** background-blend-mode, when `img` carries several images. */
	bgBlend?: string;
	/** mix-blend-mode against the card beneath. */
	blend: string;
	/** The crush. Contrast up, saturation down, is what turns a soft ramp into
	 *  hard bands; pushing both reads as a broken JPEG rather than as metal. */
	filter: string;
	/** Opacity at rest (face-on). */
	base: number;
	/** How much opacity is ADDED at full tilt. Negative fades the layer out as
	 *  the card turns, which several reference materials use to hand off between
	 *  two layers rather than simply piling both on. */
	gain: number;
}

/** One foil material: up to three layers over the fixed pink print. */
export interface Foil {
	key: string;
	label: string;
	layers: Layer[];
	/** How far the whole sheet slides per unit of tilt. THE most important
	 *  number: a sheet that tracks 1:1 reads as a gradient following a cursor,
	 *  one that barely moves reads as a layer sitting above the print. */
	parallax: number;
	/** How hard the material comes up as the card turns off face-on. */
	bloom: number;
	glare: number;
}

/**
 * THE MATERIALS.
 *
 * Ten genuinely different TECHNIQUES — a sparkle field, a conic swirl, crossed
 * grayscale ramps, a multi-scale stack — rather than one gradient in ten
 * colourways.
 */
export const FOILS: Foil[] = [
	{
		// The default. Three layers rather than one: a single desaturated sheet
		// reads as a sheen, where a real holo has actual COLOUR in it — bands you
		// can name, moving against each other as the angle changes.
		key: "holo",
		label: "Holo",
		layers: [
			{
				// The main spectral sheet. Saturation stays UP: on a pale print there
				// is nothing to overwhelm, and pulling it down leaves the card grey.
				img: rainbow("10deg", "8%"),
				size: "380% 380%",
				rate: 1,
				blend: "overlay",
				filter: "brightness(1.08) contrast(2.3) saturate(1.5)",
				base: 0.26,
				gain: 0.6,
			},
			{
				// A second sheet at a crossing angle, a coarser pitch and running
				// BACKWARDS. Where the two disagree they beat against each other, which
				// is what produces the shifting, oily quality a single sheet cannot —
				// one sheet only ever slides, two interfere.
				img: rainbow("104deg", "13%"),
				size: "300% 300%",
				rate: -0.7,
				blend: "color-dodge",
				filter: "brightness(.82) contrast(2) saturate(1.7)",
				base: 0.14,
				gain: 0.34,
			},
			{
				// Fine diffraction lines. Real foil is iridescent BECAUSE it is
				// physically ridged, and without any structure the colour reads as a
				// filter over the card rather than as light coming off a surface.
				img: "repeating-linear-gradient(96deg, rgba(255,255,255,.5) 0px, rgba(255,255,255,0) 2px, rgba(0,0,0,.16) 3px, rgba(255,255,255,0) 5px)",
				size: "auto",
				rate: 1.8,
				blend: "overlay",
				filter: "contrast(1.3)",
				base: 0.1,
				gain: 0.26,
			},
		],
		parallax: 0.26,
		bloom: 0.55,
		glare: 0.55,
	},
	{
		// Almost no gradient at all — the material IS the sparkle field, and the
		// two offset copies are what make it twinkle rather than sit still.
		key: "glitter",
		label: "Glitter",
		layers: [
			{
				img: `${GLITTER}, ${GLITTER}`,
				size: "26% 26%, 19% 19%",
				rate: 0.5,
				bgBlend: "soft-light",
				blend: "color-dodge",
				filter: "brightness(1.1) contrast(1.6) saturate(1.2)",
				base: 0.3,
				gain: 0.55,
			},
			{
				img: rainbow("122deg", "13%"),
				size: "320% 320%",
				rate: 1.4,
				blend: "overlay",
				filter: "brightness(1) contrast(2) saturate(.8)",
				base: 0.16,
				gain: 0.34,
			},
		],
		parallax: 0.3,
		bloom: 0.6,
		glare: 0.6,
	},
	{
		// Two grayscale bar ramps crossed at +/-45deg. `exclusion` between them is
		// the trick: where the ramps agree they cancel toward black, where they
		// disagree they light up, so the crossings sparkle without any colour in
		// the layer at all.
		key: "prism",
		label: "Prism",
		layers: [
			{
				img:
					"repeating-linear-gradient(45deg, hsl(0,0%,10%) 0%, hsl(0,0%,22%) 1.4%, hsl(0,0%,42%) 2.6%, hsl(0,0%,50%) 3.4%, hsl(0,0%,32%) 4.6%, hsl(0,0%,8%) 6%), " +
					"repeating-linear-gradient(-45deg, hsl(0,0%,10%) 0%, hsl(0,0%,24%) 1.6%, hsl(0,0%,46%) 3%, hsl(0,0%,52%) 3.8%, hsl(0,0%,28%) 5.2%, hsl(0,0%,8%) 6.6%)",
				size: "210% 210%, 190% 190%",
				rate: 1.5,
				bgBlend: "exclusion",
				blend: "color-dodge",
				filter: "brightness(.62) contrast(2.2) saturate(1.6)",
				base: 0.3,
				gain: 0.5,
			},
			{
				img: rainbow("55deg", "16%"),
				size: "400% 100%",
				rate: -2.5,
				blend: "color-dodge",
				filter: "brightness(.6) contrast(2.4) saturate(1.7)",
				base: 0.2,
				gain: 0.4,
			},
		],
		parallax: 0.24,
		bloom: 0.55,
		glare: 0.52,
	},
	{
		// A conic reads completely differently from a linear ramp: the spectrum
		// wraps around a point instead of running across, so tilting SPINS the
		// colour rather than sliding it.
		key: "conic",
		label: "Conic",
		layers: [
			{
				img: `conic-gradient(from var(--spin, 0deg) at 50% 50%, ${S[3]}, ${S[4]}, ${S[5]}, ${S[0]}, ${S[1]}, ${S[2]}, ${S[3]})`,
				size: "cover",
				rate: 0,
				blend: "color-dodge",
				filter: "brightness(.55) contrast(1.5) saturate(2.4)",
				base: 0.22,
				gain: 0.42,
			},
			{
				img: `${GLITTER}, ${GLITTER}`,
				size: "24% 24%, 17% 17%",
				rate: 0.7,
				bgBlend: "hard-light",
				blend: "color-dodge",
				filter: "brightness(1.05) contrast(1.5)",
				base: 0.26,
				gain: 0.5,
			},
		],
		parallax: 0.22,
		bloom: 0.5,
		glare: 0.58,
	},
	{
		// Three star plates at different scales and rates over a wide spectrum.
		// The rate spread is the whole effect: near stars sweep, far stars barely
		// move, and the card gains real depth.
		key: "cosmos",
		label: "Cosmos",
		layers: [
			{
				img: `${STARS}, ${rainbow("82deg", "8%")}`,
				size: "38% 38%, 420% 900%",
				rate: 0.35,
				bgBlend: "color-burn",
				blend: "color-dodge",
				filter: "brightness(1) contrast(1.6) saturate(.9)",
				base: 0.28,
				gain: 0.45,
			},
			{
				img: STARS,
				size: "22% 22%",
				rate: 1.6,
				blend: "overlay",
				filter: "brightness(1.3) contrast(1.7)",
				base: 0.2,
				gain: 0.4,
			},
			{
				img: STARS,
				size: "13% 13%",
				rate: 2.6,
				blend: "overlay",
				filter: "brightness(1.1) contrast(1.5)",
				base: 0.12,
				gain: 0.3,
			},
		],
		parallax: 0.34,
		bloom: 0.55,
		glare: 0.46,
	},
	{
		// Two full spectra at different angles, one muted and running BACKWARDS
		// (rate -1.5). Where they cross they interfere, which is what gives this
		// one its oily, shifting quality.
		key: "rainbow",
		label: "Rainbow",
		layers: [
			{
				img: rainbow("0deg", "14%", [
					"hsla(283,49%,60%,.75)",
					"hsla(2,70%,58%,.75)",
					"hsla(53,67%,53%,.75)",
					"hsla(93,56%,52%,.75)",
					"hsla(176,38%,50%,.75)",
					"hsla(228,100%,77%,.75)",
				]),
				size: "200% 400%",
				rate: 1,
				blend: "color-dodge",
				filter: "brightness(.9) contrast(2.6) saturate(1.6)",
				base: 0.24,
				gain: 0.44,
			},
			{
				img: "linear-gradient(-30deg, hsl(0,57%,37%), hsl(40,53%,39%), hsl(90,60%,35%), hsl(180,60%,35%), hsl(210,57%,39%), hsl(280,55%,31%), hsl(0,57%,37%))",
				size: "400% 400%",
				rate: -1.5,
				blend: "color-dodge",
				filter: "brightness(1.1) contrast(2) saturate(1.2)",
				base: 0.3,
				// Fades OUT as the card turns, handing the surface to the layer above
				// rather than both piling on.
				gain: -0.18,
			},
		],
		parallax: 0.3,
		bloom: 0.5,
		glare: 0.5,
	},
	{
		// A very tall, very narrow gradient (200% x 700%) reads as a vertical
		// STREAK rather than a field.
		key: "refractor",
		label: "Refractor",
		layers: [
			{
				img: rainbow("125deg", "7%", [
					"hsl(176,100%,76%)",
					"hsl(196,100%,78%)",
					"hsl(214,100%,76%)",
					"hsl(228,100%,74%)",
					"hsl(200,100%,80%)",
					"hsl(168,100%,78%)",
				]),
				size: "200% 700%",
				rate: 1.2,
				// NOT `hue`: it takes the sheet's hue and DISCARDS the backdrop's,
				// which turns a flat pink print blue-grey. The tall narrow gradient is
				// what makes this read as a streak; the blend just has to let the
				// print through.
				blend: "color-dodge",
				filter: "brightness(.7) contrast(1.8) saturate(1.9)",
				base: 0.22,
				gain: 0.4,
			},
			{
				img: "repeating-linear-gradient(100deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 1.2%, rgba(0,0,0,.25) 2.2%, rgba(255,255,255,0) 3.4%)",
				size: "300% 100%",
				rate: -0.8,
				blend: "hard-light",
				filter: "brightness(1.05) contrast(1.4)",
				base: 0.18,
				gain: 0.36,
			},
		],
		parallax: 0.18,
		bloom: 0.55,
		glare: 0.64,
	},
	{
		// A multi-scale stack: 1100% / 600% / 200% in one layer. `difference` on
		// near-identical ramps is what produces the dark oily banding.
		key: "velvet",
		label: "Velvet",
		layers: [
			{
				img: `${rainbow("-33deg", "6%")}, ${rainbow("133deg", "3%", ["hsla(227,53%,12%,.5)", "hsl(180,10%,50%)", "hsl(83,50%,35%)", "hsl(180,10%,50%)", "hsla(227,53%,12%,.5)", "hsla(227,53%,12%,.5)"])}`,
				size: "1100% 1100%, 600% 600%",
				rate: 1,
				bgBlend: "difference",
				blend: "color-dodge",
				filter: "brightness(.75) contrast(2) saturate(1.1)",
				base: 0.3,
				gain: 0.48,
			},
			{
				img: "radial-gradient(farthest-corner circle at var(--gx,50%) var(--gy,50%), hsla(189,76%,77%,.6) 0%, hsla(147,59%,77%,.6) 25%, hsla(271,55%,69%,.6) 50%, hsla(355,56%,72%,.6) 75%)",
				size: "200% 200%",
				rate: 0.4,
				blend: "soft-light",
				filter: "saturate(1.5)",
				base: 0.4,
				gain: 0.3,
			},
		],
		parallax: 0.28,
		bloom: 0.6,
		glare: 0.5,
	},
	{
		// `exclusion` inverts the surface where the sheet is bright, so this one
		// goes COLD and slightly negative at the extremes rather than brightening.
		key: "ice",
		label: "Ice",
		layers: [
			{
				img: rainbow("115deg", "10%", [
					"hsl(190,90%,80%)",
					"hsl(210,85%,82%)",
					"hsl(230,80%,80%)",
					"hsl(250,70%,82%)",
					"hsl(200,90%,85%)",
					"hsl(175,80%,82%)",
				]),
				size: "300% 300%",
				rate: 1.1,
				// `exclusion` INVERTS what is under it, which is this material's whole
				// character — it goes cold and slightly negative where it catches
				// rather than simply brightening. But it inverts the print too, so the
				// opacity has to stay low enough that the card is still pink
				// underneath. Past ~0.35 here the card turns beige and stops being the
				// same card.
				blend: "exclusion",
				filter: "brightness(.8) contrast(1.6) saturate(1.3)",
				base: 0.12,
				gain: 0.22,
			},
			{
				img: `${GRAIN}, ${GLITTER}`,
				size: "38% 38%, 22% 22%",
				rate: 0.6,
				bgBlend: "overlay",
				blend: "hard-light",
				filter: "brightness(1.1) contrast(1.3)",
				base: 0.18,
				gain: 0.34,
			},
		],
		parallax: 0.2,
		bloom: 0.5,
		glare: 0.62,
	},
	{
		// The restrained one: a fine near-neutral pitch that only barely shifts.
		// The only material that flatters the photograph rather than competing
		// with it, and the one to reach for if the card has to be read.
		key: "brushed",
		label: "Brushed",
		layers: [
			{
				img: rainbow("94deg", "4%", [
					"hsl(30,40%,86%)",
					"hsl(200,30%,88%)",
					"hsl(260,25%,87%)",
					"hsl(180,25%,89%)",
					"hsl(40,30%,88%)",
					"hsl(220,25%,87%)",
				]),
				size: "260% 260%",
				rate: 0.8,
				blend: "soft-light",
				filter: "brightness(1.02) contrast(1.7) saturate(.55)",
				base: 0.34,
				gain: 0.3,
			},
			{
				img: GRAIN,
				size: "34% 34%",
				rate: 0.3,
				blend: "overlay",
				filter: "brightness(1) contrast(1.1)",
				base: 0.14,
				gain: 0.16,
			},
		],
		parallax: 0.13,
		bloom: 0.32,
		glare: 0.34,
	},
];

/** Look up a foil material by key. Throws if the key is not in FOILS. */
export function foilByKey(key: string): Foil {
	const found = FOILS.find((f) => f.key === key);
	if (!found) throw new Error(`Unknown foil: ${key}`);
	return found;
}

/** Maximum tilt at the card's edge. Small: past ~16deg the perspective
 *  distortion starts to read as a fold rather than a tilt. */
export const MAX_TILT = 14;

/** Remap a value from one range onto another. Nearly every derived figure below
 *  goes through this, which is what keeps them all in agreement. */
export function adjust(
	v: number,
	fromMin: number,
	fromMax: number,
	toMin: number,
	toMax: number,
): number {
	return toMin + ((toMax - toMin) * (v - fromMin)) / (fromMax - fromMin);
}

export function clamp(v: number, min = -1, max = 1): number {
	return Math.min(Math.max(v, min), max);
}

/**
 * A damped follower.
 *
 * Not a spring with overshoot — a simple exponential ease toward a target, run
 * per frame. Overshoot is wrong here: a card settling should look like weight,
 * not like a bounce, and a bouncing card immediately reads as a web animation
 * rather than as an object.
 *
 * `stiffness` is the fraction of the remaining distance covered each frame, so
 * a lower number is heavier.
 */
export class Follow {
	value: Vec = { x: 0, y: 0 };
	target: Vec = { x: 0, y: 0 };
	/**
	 * How far this follower moved on the last frame.
	 *
	 * Position alone cannot tell whether you are creeping across the card or
	 * whipping past it, and a material that responds identically to both does
	 * not read as physical. Velocity is what lets the foil streak under a fast
	 * pass and the card lean into its own motion.
	 *
	 * It is simply the per-frame delta rather than a separate integrator: the
	 * follower is already an exponential ease, so its delta is proportional to
	 * the distance still to cover, which is exactly the "effort" signal wanted.
	 */
	velocity: Vec = { x: 0, y: 0 };
	/** Smoothed magnitude of that velocity, 0..1-ish. Raw per-frame deltas are
	 *  spiky enough to make anything driven by them flicker, so consumers read
	 *  this instead. */
	speed = 0;

	constructor(private stiffness: number) {}

	step() {
		const px = this.value.x;
		const py = this.value.y;
		this.value.x += (this.target.x - this.value.x) * this.stiffness;
		this.value.y += (this.target.y - this.value.y) * this.stiffness;
		this.velocity.x = this.value.x - px;
		this.velocity.y = this.value.y - py;
		// Asymmetric smoothing: rises fast so a flick registers on the frame it
		// happens, falls slowly so the streak it leaves decays instead of snapping
		// off the moment the pointer stops. A symmetric filter gives you one or the
		// other, never both.
		const raw = Math.min(1, Math.hypot(this.velocity.x, this.velocity.y) * 14);
		this.speed += (raw - this.speed) * (raw > this.speed ? 0.45 : 0.06);
	}

	/** True once it has effectively arrived, so a caller can stop its rAF loop
	 *  rather than burning frames on sub-pixel movement forever. Velocity is part
	 *  of the test: a follower can sit on its target for one frame mid-overshoot,
	 *  and stopping there would freeze the card off-centre. */
	get settled(): boolean {
		return (
			Math.abs(this.target.x - this.value.x) < 0.0006 &&
			Math.abs(this.target.y - this.value.y) < 0.0006 &&
			this.speed < 0.004
		);
	}
}

/**
 * A one-shot overshoot, for the moment the pointer leaves.
 *
 * Real objects do not glide to a stop along the shortest path — they carry
 * past a little on the axis they were pushed and settle back.
 *
 * Deliberately NOT a spring on the main follower: a spring rings on every
 * movement, and a card that wobbles whenever you nudge it reads as a web
 * animation. This fires once, scaled by how fast you were going, and decays to
 * nothing.
 */
export class Kick {
	private amount: Vec = { x: 0, y: 0 };
	private life = 0;

	/** Fire it. `v` is the velocity at the moment of release. */
	fire(v: Vec, gain = 2.6) {
		const mag = Math.hypot(v.x, v.y);
		// Below a threshold there was no throw — just a pointer leaving the box —
		// and adding a bounce there would look like a twitch.
		if (mag < 0.002) return;
		this.amount = { x: v.x * gain, y: v.y * gain };
		this.life = 1;
	}

	/** Advance and return the current offset to add to the target. */
	step(): Vec {
		if (this.life <= 0) return { x: 0, y: 0 };
		this.life = Math.max(0, this.life - 0.035);
		// A half sine over the life: rises to the overshoot, returns through zero.
		// Ending at exactly zero is the point — a decaying oscillation would leave
		// the card fractionally off true.
		const e = Math.sin(this.life * Math.PI) * this.life;
		return { x: this.amount.x * e, y: this.amount.y * e };
	}

	get active(): boolean {
		return this.life > 0;
	}
}

/**
 * Device orientation, zeroed on the first reading.
 *
 * THIS IS THE DETAIL THAT MAKES TILT USABLE. Absolute orientation is useless
 * because nobody holds a phone flat — beta sits somewhere around 40-70deg for a
 * person looking at a screen, so an un-zeroed reading pins the card to one
 * corner and it never comes back. Taking the first event as the origin means the
 * card responds to how far you have tilted FROM WHERE YOU ALREADY WERE.
 */
export class Orientation {
	private base: { beta: number; gamma: number } | null = null;
	/** Degrees of tilt that maps to the full -1..1 range. Small, because wrist
	 *  movement is small: at 45deg you would have to turn the phone over. */
	private range = 22;

	read(e: DeviceOrientationEvent): Vec | null {
		const beta = e.beta;
		const gamma = e.gamma;
		if (beta == null || gamma == null) return null;
		if (!this.base) {
			this.base = { beta, gamma };
			return { x: 0, y: 0 };
		}
		return {
			x: clamp((gamma - this.base.gamma) / this.range),
			y: clamp((beta - this.base.beta) / this.range),
		};
	}

	/** Re-zero, e.g. when the card comes back on screen and the phone has moved. */
	reset() {
		this.base = null;
	}
}

/** Pointer position within an element, normalised to -1..1 from its centre. */
export function fromPointer(rect: DOMRect, cx: number, cy: number): Vec {
	return {
		x: clamp(((cx - rect.left) / rect.width) * 2 - 1),
		y: clamp(((cy - rect.top) / rect.height) * 2 - 1),
	};
}

/** The per-material numbers the frame loop reads. Split out from `Foil` so the
 *  playground can override them from its sliders without cloning the material. */
export interface Live {
	parallax: number;
	bloom: number;
}

/**
 * Write one frame's worth of CSS variables onto the card element.
 *
 * The card and the playground mount the same DOM and want the same maths, so
 * this lives here rather than being duplicated in both — they differ only in
 * where their numbers come from (a fixed material vs. live sliders).
 *
 * `tilt` drives everything attached to the card's own geometry (the rotation,
 * the bar angle, the glare) and `sheet` drives the foil, which lags behind it.
 */
/** Per-frame signals beyond position. Optional so existing callers (the swatch
 *  preview, any static render) keep working with a single settled pose. */
export interface Motion {
	/** Smoothed speed of the card, 0..1. */
	speed?: number;
	/** Direction of travel, for the streak. */
	velocity?: Vec;
	/** Seconds since mount, for the slow resting cycles. */
	time?: number;
}

export function applyFrame(
	card: HTMLElement,
	tilt: Vec,
	sheet: Vec,
	foil: Foil,
	live: Live,
	motion: Motion = {},
): void {
	const { x, y } = tilt;
	const s = card.style;

	s.setProperty("--rx", `${(-y * MAX_TILT).toFixed(2)}deg`);
	s.setProperty("--ry", `${(x * MAX_TILT).toFixed(2)}deg`);

	// THE COMPRESSED RANGE. The foil travels a fraction of the pointer's own
	// distance — a sheet that tracks 1:1 reads as a following gradient, where one
	// that barely moves reads as a layer sitting above the print. This is the
	// single most important number in the effect.
	const p = live.parallax;

	// EACH LAYER MOVES AT ITS OWN RATE, and some move against the pointer. Two
	// layers travelling together are just one thicker layer; it is the
	// disagreement between them that reads as depth and as shimmer.
	for (let i = 0; i < LAYER_SLOTS; i++) {
		const L = foil.layers[i];
		if (!L) continue;
		const t = p * L.rate;
		const n = `--l${i + 1}`;
		s.setProperty(
			`${n}-x`,
			`${adjust(sheet.x, -1, 1, 50 - t * 100, 50 + t * 100).toFixed(1)}%`,
		);
		s.setProperty(
			`${n}-y`,
			`${adjust(sheet.y, -1, 1, 50 - t * 100, 50 + t * 100).toFixed(1)}%`,
		);
	}

	// HOW FAR FROM FACE-ON, 0..1 — and the card's whole decoration budget. The
	// pattern, the bars and the foil all buy their opacity out of this, so a card
	// at rest is a clean printed surface and a card being turned is alive.
	//
	// It is a DISTANCE, so it is symmetric: tilting left and tilting right give
	// the same value, and the decoration comes up the same way whichever side you
	// move to. Driving it off a signed axis instead would light one side and leave
	// the other dead, which is the thing that looked broken.
	const off = Math.min(1, Math.hypot(x, y));
	// Exposed for inspection while tuning (nothing styles off it directly — the
	// curves that use it are computed here in JS).
	s.setProperty("--off", off.toFixed(3));

	// THE HEARTS ONLY SHOW AT AN ANGLE.
	//
	// Not a fade from zero — a THRESHOLD. Below `HEART_FROM` the card is perfectly
	// clean, and past it the hearts ramp in over the remaining travel. That gap is
	// the whole point: a decoration that is always slightly visible is just
	// decoration, where one that is absent and then arrives reads as something the
	// surface was hiding until it caught the light.
	//
	// Smoothstep rather than a linear ramp, so it eases in at the threshold
	// instead of switching on with a visible corner.
	// Driven by the SHEET, not the card. The sheet is the heavier follower, so the
	// hearts inherit its lag for free and can never appear in a single frame the
	// way they did when this read the fast tilt value — and it is the physically
	// right source anyway, since a varnish catching light belongs to the surface
	// rather than to the card's own geometry.
	const softOff = Math.min(1, Math.hypot(sheet.x, sheet.y));
	const HEART_FROM = 0.34;
	const t = Math.max(0, Math.min(1, (softOff - HEART_FROM) / (1 - HEART_FROM)));
	s.setProperty("--reveal", (t * t * (3 - 2 * t) * 0.9).toFixed(3));

	// AND ONLY WHERE THE LIGHT IS.
	//
	// Revealing the whole field at once was the other half of the bug: tilt the
	// left edge toward you and hearts appeared across the entire card, including
	// the far side that is angled AWAY and should be catching nothing. A varnish
	// is only visible where light is actually striking it, so the layer is masked
	// to a soft band that follows the tilt — the hearts surface on the side you
	// turned toward you and stay hidden on the other.
	//
	// The mask's angle points along the tilt direction and its centre rides out
	// toward that edge, so the band travels across the card as you move rather
	// than fading up in place.
	// Same lagged source as the opacity above. Reading the fast tilt here while
	// the opacity eased on the slow one made the band swing into place before the
	// hearts had faded up, which reads as two separate things happening.
	const ang = Math.atan2(sheet.y, sheet.x) * (180 / Math.PI);
	s.setProperty("--reveal-angle", `${(ang + 90).toFixed(0)}deg`);
	s.setProperty("--reveal-x", `${adjust(sheet.x, -1, 1, 78, 22).toFixed(1)}%`);
	s.setProperty("--reveal-y", `${adjust(sheet.y, -1, 1, 78, 22).toFixed(1)}%`);

	// The foil brightens as the card turns away from face-on: a real sheet catches
	// hardest at an angle and is nearly invisible looked at straight down.
	// THE SWEET SPOT.
	//
	// Real foil has one angle where the whole surface lines up and goes brilliant,
	// and hunting for it is most of why anyone keeps turning a card. It sits
	// off-centre on purpose — the middle is where the card rests, and a bloom you
	// get for free is not worth finding.
	//
	// The falloff is deliberately tight: a wide one just makes the card brighter
	// on one side, where a narrow one means you sweep past it, notice, and come
	// back. Computed here because every layer's opacity reads it.
	const SPOT = { x: -0.42, y: -0.36 };
	const dSpot = Math.hypot(sheet.x - SPOT.x, sheet.y - SPOT.y);
	const hit = Math.max(0, 1 - dSpot / 0.34);
	const spotBloom = hit * hit * (3 - 2 * hit);

	// A very slow resting cycle, so the material is alive while the card is
	// untouched. Two incommensurate periods, so it never visibly loops.
	const breathNow =
		0.5 +
		0.5 *
			Math.sin((motion.time ?? 0) * 0.5) *
			Math.cos((motion.time ?? 0) * 0.31);

	// Per-layer opacity. `base` is what the layer shows face-on and `gain` is
	// what tilt ADDS — gain may be negative, which fades a layer out as the card
	// turns so the material hands off between its layers instead of piling both
	// on at full tilt.
	for (let i = 0; i < LAYER_SLOTS; i++) {
		const L = foil.layers[i];
		if (!L) continue;
		let o = Math.max(0, L.base + off * L.gain * (live.bloom / 0.5));
		// The sweet spot lifts every layer at once — that simultaneity is what makes
		// it read as the material aligning rather than one sheet brightening.
		o *= 1 + spotBloom * 0.85;
		// and the resting breath moves it very slightly, so a still card is not a
		// frozen one.
		o *= 0.94 + breathNow * 0.06;
		s.setProperty(`--l${i + 1}-o`, Math.min(1, o).toFixed(3));
	}

	// The conic material spins rather than slides: its spectrum wraps around a
	// point, so the equivalent of sliding a linear ramp is turning the start
	// angle. Harmless for every other material, which never reads it.
	s.setProperty("--spin", `${(sheet.x * 90 + sheet.y * 45).toFixed(1)}deg`);

	// The glare tracks the pointer DIRECTLY, with no lag — a highlight is simply
	// where the light is, so lagging it would look like a mistake.
	s.setProperty("--gx", `${adjust(x, -1, 1, 12, 88).toFixed(1)}%`);
	s.setProperty("--gy", `${adjust(y, -1, 1, 12, 88).toFixed(1)}%`);

	// The tile drifts very slightly against the card face, so the two planes read
	// as separate. A quarter of the foil's travel: enough to separate them, not
	// enough to look detached.
	s.setProperty("--tile-x", `${adjust(sheet.x, -1, 1, 58, 42).toFixed(1)}%`);

	// THE TILE CATCHES LIGHT — Sense membership, not the Vault art demo.
	//
	// A full invert wipe across a real patron face reads as uncanny (fine on a
	// stylised print; wrong on an identity card). We keep a directional sweep,
	// but: later threshold, capped coverage, and CSS feathers + softer filters
	// so the portrait stays recognisable.
	const FLIP_FROM = 0.72; // stay natural through most of the tilt travel
	const flipRaw = Math.max(
		0,
		Math.min(1, (softOff - FLIP_FROM) / (1 - FLIP_FROM)),
	);
	// Cap how much of the tile can go "negative" — never a full-face invert.
	const flip = flipRaw * 0.38;
	s.setProperty("--tile-invert", flip.toFixed(3));
	// Narrower hue travel so the sweep stays in one family with the print.
	s.setProperty("--tile-hue", `${(200 + flipRaw * 40).toFixed(0)}deg`);
	s.setProperty(
		"--tile-sweep-angle",
		`${(Math.atan2(sheet.y, sheet.x) * (180 / Math.PI) + 90).toFixed(0)}deg`,
	);

	// ── MOTION ────────────────────────────────────────────────────────────────
	const speed = motion.speed ?? 0;
	const vel = motion.velocity ?? { x: 0, y: 0 };

	// Same: a handle for tuning. The visible use of speed is --smear below.
	s.setProperty("--speed", speed.toFixed(3));

	// THE STREAK. A fast pass smears the highlight along the direction of travel;
	// a slow one leaves it round. This is the clearest read of velocity on the
	// card, and it costs one gradient angle plus a length.
	const vmag = Math.hypot(vel.x, vel.y);
	if (vmag > 0.0001) {
		s.setProperty(
			"--smear-angle",
			`${(Math.atan2(vel.y, vel.x) * (180 / Math.PI)).toFixed(0)}deg`,
		);
	}
	s.setProperty("--smear", (Math.min(1, speed) * 0.8).toFixed(3));

	// THE SWEET SPOT.
	//
	// Real foil has one angle where the whole surface lines up and goes brilliant,
	// and hunting for it is most of why people keep turning a card. Here it is a
	// fixed point off-centre — not the middle, because the middle is where the
	// card rests and a bloom you get for free is not worth finding.
	//
	// The falloff is deliberately tight. A wide one just makes the card brighter
	// on one side; a narrow one means you sweep past it, notice, and go back.
	s.setProperty("--spot", spotBloom.toFixed(3));

	// EMBOSSING. The type takes its highlight from the opposite side to the
	// shadow, both driven by tilt, so the letters catch light like they were
	// pressed into the stock rather than printed on it.
	// Under a pixel of travel: an emboss you can measure is a bevel, and the
	// letters should look pressed into the stock rather than raised off it.
	s.setProperty("--emboss-x", `${(-x * 0.9).toFixed(2)}px`);
	s.setProperty("--emboss-y", `${(-y * 0.9).toFixed(2)}px`);

	// EDGE CATCH. Each border lights independently by how much it faces the
	// viewer, so the card reads as having thickness instead of a uniform rim.
	s.setProperty("--edge-l", Math.max(0, -x).toFixed(3));
	s.setProperty("--edge-r", Math.max(0, x).toFixed(3));
	s.setProperty("--edge-t", Math.max(0, -y).toFixed(3));
	s.setProperty("--edge-b", Math.max(0, y).toFixed(3));

	s.setProperty("--breath", breathNow.toFixed(3));
}

/** How many foil layers the CSS provides. A material with fewer simply leaves
 *  the rest empty. */
export const LAYER_SLOTS = 3;

export interface ApplyFoilOpts {
	tileSrc: string;
	bodyGrad: string;
	tileDark: string;
	tileLight: string;
}

/**
 * Push a material's static (non-per-frame) variables onto the card.
 *
 * Separate from `applyFrame` because these only change when the preset does,
 * and re-writing two dozen properties every frame would be pure waste.
 *
 * Unused layer slots are explicitly blanked rather than left alone: switching
 * from a 3-layer material to a 1-layer one has to CLEAR the old slots, or the
 * previous material's second and third layers stay painted underneath the new
 * one and every preset after the first is a blend of two materials.
 *
 * Sense: tile/body colours come from the caller (tier print map), not a fixed
 * Kamila / Vault pink print.
 */
export function applyFoil(
	card: HTMLElement,
	foil: Foil,
	opts: ApplyFoilOpts,
): void {
	const s = card.style;
	s.setProperty("--tile-src", `url("${opts.tileSrc}")`);
	s.setProperty("--body-grad", opts.bodyGrad);
	s.setProperty("--tile-dark", opts.tileDark);
	s.setProperty("--tile-light", opts.tileLight);
	s.setProperty("--glare-o", `${foil.glare}`);

	for (let i = 0; i < LAYER_SLOTS; i++) {
		const n = `--l${i + 1}`;
		const L = foil.layers[i];
		if (!L) {
			// `none` rather than an empty string: an empty background-image is
			// invalid and falls back to the property's initial value, which in a
			// stacked context can resolve to the previous declaration.
			s.setProperty(`${n}-img`, "none");
			s.setProperty(`${n}-o`, "0");
			continue;
		}
		s.setProperty(`${n}-img`, L.img);
		s.setProperty(`${n}-size`, L.size);
		s.setProperty(`${n}-bgblend`, L.bgBlend ?? "normal");
		s.setProperty(`${n}-blend`, L.blend);
		s.setProperty(`${n}-filter`, L.filter);
	}
}
