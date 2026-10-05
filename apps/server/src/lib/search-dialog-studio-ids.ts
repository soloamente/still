/**
 * TMDb production company ids for the search dialog studio rail + tag autocomplete.
 * Logos: Logo.dev (web pills) + TMDb `logo_path`; six ids also have themed PNGs under `public/studios/`.
 */
const SEARCH_DIALOG_STUDIO_IDS_RAW = [
	// Indie & specialty
	41077, // A24
	90733, // NEON
	10146, // Focus Features
	13184, // Annapurna Pictures
	3172, // Blumhouse Productions
	429, // Searchlight Pictures
	437, // Sony Pictures Classics
	3528, // IFC Films
	30666, // Open Road Films
	18868, // Roadside Attractions
	4993, // STX Entertainment
	9350, // Participant
	// Majors & studio groups
	2, // Walt Disney Pictures
	6125, // Walt Disney Animation Studios
	3, // Pixar
	420, // Marvel Studios
	1, // Lucasfilm
	127928, // 20th Century Studios
	128064, // Warner Bros. Pictures
	12, // New Line Cinema
	33, // Universal Pictures
	5391, // Illumination
	521, // DreamWorks Animation
	9195, // DreamWorks Pictures
	4, // Paramount Pictures
	5, // Columbia Pictures
	559, // TriStar Pictures
	34, // Sony Pictures
	8411, // Metro-Goldwyn-Mayer
	491, // Lionsgate
	923, // Legendary Entertainment
	109501, // Skydance Media
	6947, // Working Title Films
	694, // StudioCanal
	79, // Village Roadshow Pictures
	506, // Regency Enterprises
	14, // Miramax
	56, // Amblin Entertainment
	7295, // Plan B Entertainment
	114686, // Bad Robot Productions
	// Streaming & tech-backed
	213004, // Netflix
	20580, // Amazon Studios
	148495, // Apple Original Films
	7429, // HBO Films
	// International (common in US catalogues)
	882, // Toho Company
	10342, // Studio Ghibli
	11537, // Laika
	3324, // BBC Film
	6704, // Film4 Productions
	8565, // British Film Institute
	// Mid-size / genre staples
	11768, // Chernin Entertainment
	456, // TSG Entertainment
	11840, // FilmNation Entertainment
	2575, // Alcon Entertainment
	34440, // EON Productions
	70728, // Vertigo Entertainment
	10761, // Entertainment One
	5035, // The Criterion Collection
	23442, // Studio Ponoc
	64720, // Shochiku
	5882, // Toei Company
	3035, // Kadokawa Daiei Studio
	23434, // Yash Raj Films
	23437, // Dharma Productions
	23448, // Red Chillies Entertainment
	23449, // Excel Entertainment
	11586, // Gaumont
	8567, // Pathé
	6878, // Wild Bunch
	23411, // Canal+
	120526, // CJ Entertainment
	2000, // Showbox
	8866, // MUBI
	1637, // Summit Entertainment
	3281, // Annapurna (legacy id — deduped if same as 13184)
	60, // United Artists
	58, // Original Film
	163675, // AGBO
] as const;

/** Unique ids in rail order (first occurrence wins). */
export const SEARCH_DIALOG_STUDIO_IDS: readonly number[] = [
	...new Set(SEARCH_DIALOG_STUDIO_IDS_RAW),
];
