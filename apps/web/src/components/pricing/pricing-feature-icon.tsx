import IconAwardFill from "@still/ui/icons/award-fill";
import IconBellFilled from "@still/ui/icons/bell-filled";
import IconCinema from "@still/ui/icons/cinema";
import IconClockRotateClockwise from "@still/ui/icons/clock-rotate-clockwise";
import IconCloneImageDashedFill from "@still/ui/icons/clone-image-dashed-fill";
import IconEarthPinFill from "@still/ui/icons/earth-pin-fill";
import IconFeedbackSend from "@still/ui/icons/feedback-send";
import IconGear from "@still/ui/icons/gear";
import IconGlobePointerFill from "@still/ui/icons/globe-pointer-fill";
import IconHeartFilled from "@still/ui/icons/heart-filled";
import IconOpenExternalFill from "@still/ui/icons/open-external-fill";
import IconPeople from "@still/ui/icons/people";
import IconQuotesFilled from "@still/ui/icons/quotes-filled";
import IconSlider from "@still/ui/icons/slider";
import IconStreakFlameFilled from "@still/ui/icons/streak-flame-filled";
import IconTicketFilled from "@still/ui/icons/ticket-filled";
import IconTvShows from "@still/ui/icons/tv-shows";
import IconYearInFilm from "@still/ui/icons/year-in-film";
import { cn } from "@still/ui/lib/utils";
import { type LucideIcon, Target } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { PricingCheckIcon } from "@/components/pricing/pricing-check-icon";
import {
	PricingIconAppCredits,
	PricingIconBetaAccess,
	PricingIconDevotedBadge,
	PricingIconDevotedGem,
	PricingIconInnerCircle,
	PricingIconLeaderboard,
	PricingIconPalette,
	PricingIconPinnedReviews,
	PricingIconPrivateLists,
	PricingIconRivalryMode,
	PricingIconSupporters,
	PricingIconTasteOverlap,
	PricingIconVote,
} from "@/components/pricing/pricing-nucleo-feature-icons";

type PricingFeatureIconComponent = ComponentType<
	SVGProps<SVGSVGElement> & { size?: string }
>;

/** Tier-card feature row icon — 24px glyphs, centered on the 24px title line. */
export const PRICING_FEATURE_ICON_CLASS = "shrink-0 text-foreground";

/** Nucleo catalogue icons — explicit 24px to match custom pricing glyphs. */
export const PRICING_FEATURE_ICON_SIZE = "24px";
const PRICING_FEATURE_ICON_SIZE_CLASS = "size-6";

/** Wrap Lucide glyphs so they match Nucleo row sizing on tier cards. */
function lucidePricingIcon(Icon: LucideIcon): PricingFeatureIconComponent {
	function LucidePricingFeatureIcon({
		className,
		size: _size,
		...props
	}: SVGProps<SVGSVGElement> & { size?: string }) {
		return (
			<Icon
				{...props}
				className={cn(
					PRICING_FEATURE_ICON_SIZE_CLASS,
					"shrink-0 text-foreground",
					className,
				)}
				strokeWidth={2.25}
				aria-hidden
			/>
		);
	}

	return LucidePricingFeatureIcon;
}

/** One distinct glyph per catalogue key — falls back to the filled check when unknown. */
const PRICING_FEATURE_ICON_BY_KEY: Record<string, PricingFeatureIconComponent> =
	{
		log_movies_tv: IconCinema,
		watchlist_ratings: IconHeartFilled,
		reviews_lists: IconQuotesFilled,
		follow_feed: IconPeople,
		import_services: IconOpenExternalFill,
		tv_episode_progress: IconTvShows,
		basic_streaks_badges: IconStreakFlameFilled,
		year_in_review: IconYearInFilm,
		full_stats: IconSlider,
		taste_signature: IconEarthPinFill,
		activity_signature: IconClockRotateClockwise,
		streaming_filters: IconGlobePointerFill,
		watchlist_alerts: IconBellFilled,
		theater_listings: IconTicketFilled,
		advanced_feed_filters: IconGear,
		all_themes: IconCloneImageDashedFill,
		profile_customization: PricingIconPalette,
		pinned_reviews: PricingIconPinnedReviews,
		private_lists: PricingIconPrivateLists,
		taste_overlap: PricingIconTasteOverlap,
		rivalry_mode: PricingIconRivalryMode,
		badge_prestige: IconAwardFill,
		challenges: lucidePricingIcon(Target),
		leaderboard_visibility: PricingIconLeaderboard,
		vote_on_features: PricingIconVote,
		beta_access: PricingIconBetaAccess,
		direct_feedback_channel: IconFeedbackSend,
		inner_circle_community: PricingIconInnerCircle,
		app_credits: PricingIconAppCredits,
		devoted_badge: PricingIconDevotedBadge,
		supporters_page: PricingIconSupporters,
		seasonal_themes: PricingIconPalette,
		devoted_badges: PricingIconDevotedGem,
	};

/** Keys mapped to custom SVG components that carry their own pixel dimensions. */
const CUSTOM_PRICING_ICON_KEYS = new Set([
	"profile_customization",
	"pinned_reviews",
	"private_lists",
	"taste_overlap",
	"rivalry_mode",
	"leaderboard_visibility",
	"vote_on_features",
	"beta_access",
	"inner_circle_community",
	"app_credits",
	"devoted_badge",
	"supporters_page",
	"seasonal_themes",
	"devoted_badges",
]);

export function PricingFeatureIcon({
	featureKey,
	className,
}: {
	featureKey: string | null;
	className?: string;
}) {
	const Icon = featureKey ? PRICING_FEATURE_ICON_BY_KEY[featureKey] : null;

	if (!Icon) {
		return (
			<PricingCheckIcon
				className={cn(
					PRICING_FEATURE_ICON_SIZE_CLASS,
					"shrink-0 text-foreground",
					className,
				)}
			/>
		);
	}

	const isCustomIcon =
		featureKey != null && CUSTOM_PRICING_ICON_KEYS.has(featureKey);

	return (
		<Icon
			size={isCustomIcon ? undefined : PRICING_FEATURE_ICON_SIZE}
			className={cn(PRICING_FEATURE_ICON_CLASS, className)}
		/>
	);
}
