import { formatCommunityListsHeader } from "@/lib/community-lists-header";

/** Subsection label above the Community lists poster wall. */
export function CommunityListsHeader({ total }: { total: number }) {
	if (total <= 0) return null;

	return (
		<h2 className="mb-3 text-balance text-center font-medium text-foreground text-sm">
			{formatCommunityListsHeader(total)}
		</h2>
	);
}
