import { cn } from "@still/ui/lib/utils";

/** Square portrait box — matches `ProfilePatronHeader` hero PFP. */
export const PROFILE_PORTRAIT_SIZE_CLASSNAME = "size-28 sm:size-32";

/** Circular patron portrait shell for settings, onboarding, and loading previews. */
export const PROFILE_PORTRAIT_SHELL_CLASSNAME = cn(
	PROFILE_PORTRAIT_SIZE_CLASSNAME,
	"relative shrink-0 overflow-hidden rounded-full shadow-lg ring-4 ring-card",
);

/** Empty portrait tile on settings panels — raised card surface per product spec. */
export const PROFILE_PORTRAIT_EMPTY_SHELL_CLASSNAME = "bg-card";

/** Committed or staged portrait fill behind `object-cover` photo. */
export const PROFILE_PORTRAIT_FILLED_SHELL_CLASSNAME = "bg-muted/30";

/** Locked crop aspect (width / height) — square maps 1:1 to circular display. */
export const PROFILE_AVATAR_CROP_ASPECT = 1;

/** Max baked avatar output after client-side crop (WebP). */
export const PROFILE_AVATAR_CROP_MAX_PX = {
	width: 800,
	height: 800,
} as const;
