import { cn } from "@still/ui/lib/utils";

import { formatCommunityListsHeader } from "@/lib/community-lists-header";
import { HOME_COMMUNITY_FEED_COLUMN_CLASSNAME } from "@/lib/home-community-lobby-layout";

/** Subsection label above the Community lists poster wall. */
export function CommunityListsHeader({ total }: { total: number }) {
	if (total <= 0) return null;

	return (
		<h2
			className={cn(
				HOME_COMMUNITY_FEED_COLUMN_CLASSNAME,
				"mb-6 text-balance text-center font-medium text-foreground text-sm",
			)}
		>
			{formatCommunityListsHeader(total)}
		</h2>
	);
}
