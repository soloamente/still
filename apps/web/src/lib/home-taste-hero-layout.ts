/** Shared taste-hero band sizing — lobby trailer + nested hero tile stay aligned. */
export const HOME_TASTE_HERO_BAND_CLASSNAME =
	"w-full h-[min(42rem,60svh)] sm:h-[min(44rem,62svh)] lg:h-[min(48rem,66svh)] xl:h-[min(52rem,68svh)] min-[2000px]:h-[min(58rem,64svh)]";
/** Lobby shell media — bleed into catalogue `p-4` so backdrops/trailers reach the card edge. */
export const HOME_TASTE_HERO_SHELL_MEDIA_CLASSNAME =
	"pointer-events-none absolute -top-4 -right-4 -left-4 z-0 overflow-hidden rounded-t-[2.5rem]";
/** Bottom-anchored spotlight — flush to the band floor on sub-2k desktops. */
export const HOME_TASTE_HERO_BAND_CONTENT_ALIGN_CLASSNAME = "justify-end";
export const HOME_TASTE_HERO_BAND_CONTENT_INSET_CLASSNAME =
	"pb-1 sm:pb-2 min-[2000px]:pb-3";
/** Gap before the sort/venue filter row — tight on desktop per lobby feedback. */
export const HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME = "mb-2 sm:mb-6 lg:mb-8";
