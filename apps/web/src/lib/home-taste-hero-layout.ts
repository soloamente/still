/** Shared taste-hero band height — width is contextual (content `w-full`, shell bleeds `-left-4 -right-4`). */
export const HOME_TASTE_HERO_BAND_HEIGHT_CLASSNAME =
	"h-[min(42rem,60svh)] sm:h-[min(44rem,62svh)] lg:h-[min(48rem,66svh)] xl:h-[min(52rem,68svh)] min-[2000px]:h-[min(58rem,64svh)]";
/** Content column band — full width of the hero section. */
export const HOME_TASTE_HERO_BAND_CLASSNAME = `w-full ${HOME_TASTE_HERO_BAND_HEIGHT_CLASSNAME}`;
/** Lobby shell media — bleeds over catalogue padding + filter row baseline. */
export const HOME_TASTE_HERO_SHELL_MEDIA_CLASSNAME =
	"pointer-events-none absolute -top-4 -right-4 -left-4 -bottom-[4.75rem] z-0 overflow-hidden bg-absolute-black [transform:translateZ(0)]";
/** Bleed past rounded-corner anti-alias — kills card/iframe edge slivers. */
export const HOME_TASTE_HERO_MEDIA_OVERSCAN_CLASSNAME = "-inset-px";
/** Background trailer iframe — mobile default first; `sm+` / 2K breakpoints unchanged. */
export const HOME_TASTE_HERO_TRAILER_IFRAME_CLASSNAME =
	"absolute top-[57%] left-1/2 z-1 aspect-video h-auto min-h-[104%] w-auto min-w-[104%] -translate-x-1/2 -translate-y-1/2 scale-[1.53] border-0 sm:top-[58%] sm:min-h-full sm:min-w-full sm:scale-[1.32] min-[2000px]:top-[64%] min-[2000px]:scale-[1.26]";
/** Full-bleed scrims — long soft ramp anchored low (filters/posters on flat dark). */
export const HOME_TASTE_HERO_SCRIM_BOTTOM_VERTICAL_CLASSNAME =
	"absolute inset-0 z-2 bg-[linear-gradient(to_top,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.76)_4%,rgba(0,0,0,0.58)_8%,rgba(0,0,0,0.42)_11%,rgba(0,0,0,0.28)_14%,rgba(0,0,0,0.17)_17%,rgba(0,0,0,0.09)_20%,rgba(0,0,0,0.04)_23%,transparent_26%,transparent_100%)] min-[2000px]:bg-[linear-gradient(to_top,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.72)_5%,rgba(0,0,0,0.54)_9%,rgba(0,0,0,0.38)_12%,rgba(0,0,0,0.24)_15%,rgba(0,0,0,0.14)_18%,rgba(0,0,0,0.07)_21%,rgba(0,0,0,0.03)_24%,transparent_28%,transparent_100%)]";
export const HOME_TASTE_HERO_SCRIM_SIDE_CLASSNAME =
	"absolute inset-0 z-2 bg-[linear-gradient(to_right,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.1)_26%,transparent_44%,transparent_56%,rgba(0,0,0,0.1)_74%,rgba(0,0,0,0.34)_100%)] [mask-image:linear-gradient(to_bottom,transparent_0%,transparent_72%,rgba(0,0,0,0.18)_78%,rgba(0,0,0,0.48)_84%,rgba(0,0,0,0.78)_90%,black_96%)] min-[2000px]:[mask-image:linear-gradient(to_bottom,transparent_0%,transparent_70%,rgba(0,0,0,0.15)_77%,rgba(0,0,0,0.42)_83%,rgba(0,0,0,0.74)_89%,black_95%)]";
export const HOME_TASTE_HERO_SCRIM_CARD_FADE_CLASSNAME =
	"absolute inset-0 z-3 bg-[linear-gradient(to_bottom,transparent_0%,transparent_74%,color-mix(in_oklab,var(--card)_5%,transparent)_79%,color-mix(in_oklab,var(--card)_14%,transparent)_83%,color-mix(in_oklab,var(--card)_30%,transparent)_87%,color-mix(in_oklab,var(--card)_52%,transparent)_91%,color-mix(in_oklab,var(--card)_76%,transparent)_95%,var(--card)_100%)] min-[2000px]:bg-[linear-gradient(to_bottom,transparent_0%,transparent_72%,color-mix(in_oklab,var(--card)_4%,transparent)_78%,color-mix(in_oklab,var(--card)_12%,transparent)_82%,color-mix(in_oklab,var(--card)_26%,transparent)_86%,color-mix(in_oklab,var(--card)_48%,transparent)_90%,color-mix(in_oklab,var(--card)_72%,transparent)_94%,var(--card)_100%)]";
/** Filters sit on the media bleed — keep them above trailer + scrim. */
export const HOME_TASTE_HERO_FILTER_ROW_STACK_CLASSNAME = "relative z-10";
/** Mobile bleed — hero `px-3` + catalogue `p-4` (parity with media `-left-4 -right-4`). */
export const HOME_TASTE_HERO_POSTER_RAIL_MOBILE_BLEED_CLASSNAME =
	"max-sm:w-[calc(100%+3.5rem)] max-sm:max-w-none max-sm:-mx-[calc(0.75rem+1rem)]";
/** Poster rail — mobile full catalogue width; desktop flush right with capped width. */
export const HOME_TASTE_HERO_POSTER_RAIL_EDGE_FADE_WIDTH_PX = 128;
export const HOME_TASTE_HERO_POSTER_RAIL_CLIP_CLASSNAME =
	"relative min-w-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,black_2.75rem)] sm:-mr-10 sm:ml-auto sm:w-full sm:max-w-[24rem] sm:[mask-image:linear-gradient(to_right,transparent_0%,black_4.5rem)] lg:max-w-[25.5rem] min-[2000px]:max-w-[27rem] min-[2000px]:[mask-image:linear-gradient(to_right,transparent_0%,black_5rem)]";
export const HOME_TASTE_HERO_POSTER_RAIL_SCROLL_CLASSNAME =
	"dir-rtl items-end gap-2 py-1 pl-2 pr-0 max-sm:pl-3 sm:gap-3 sm:py-2 sm:pl-3 [&>*]:dir-ltr";
/** Taste-hero poster tile widths — mobile unchanged; larger on desktop. */
export const HOME_TASTE_HERO_POSTER_TILE_ACTIVE_CLASSNAME =
	"w-[4.25rem] sm:w-32";
export const HOME_TASTE_HERO_POSTER_TILE_IDLE_CLASSNAME = "w-[3.75rem] sm:w-28";
/** Bottom-anchored spotlight — flush to the band floor on sub-2k desktops. */
export const HOME_TASTE_HERO_BAND_CONTENT_ALIGN_CLASSNAME = "justify-end";
export const HOME_TASTE_HERO_BAND_CONTENT_INSET_CLASSNAME =
	"pb-1 sm:pb-2 min-[2000px]:pb-0";
/** Mobile only — drop title/rating toward filters without overlapping actions/posters. */
export const HOME_TASTE_HERO_BAND_CONTENT_MOBILE_NUDGE_CLASSNAME =
	"max-sm:mt-6";
/** Mobile — drop the whole spotlight row (actions + poster rail move together). */
export const HOME_TASTE_HERO_BAND_CONTENT_MOBILE_DROP_CLASSNAME =
	"max-sm:translate-y-10";
/** 2K+ only — drop spotlight row; mid/desktop unchanged. */
export const HOME_TASTE_HERO_BAND_CONTENT_2K_NUDGE_CLASSNAME =
	"min-[2000px]:translate-y-16";
/** 2K+ — reserve layout space so the nudge stays inside the hero section. */
export const HOME_TASTE_HERO_SECTION_2K_RESERVE_CLASSNAME =
	"min-[2000px]:pb-24";
/** Mobile reserve — keeps poster rail above the filter row without translate overlap. */
export const HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME = "max-sm:mb-10 sm:mb-0";
