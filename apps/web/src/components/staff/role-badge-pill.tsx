import { cn } from "@still/ui/lib/utils";

/** Tier tint: owner/admin stronger, others neutral. Avatar replacement. */
const TIER_CLASS: Record<string, string> = {
	owner: "bg-foreground text-background",
	admin: "bg-foreground text-background",
	moderator: "bg-background text-foreground",
	support: "bg-background text-muted-foreground",
	user: "bg-background text-muted-foreground",
};

export function RoleBadgePill({
	role,
	label,
}: {
	role: string;
	label: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex min-h-9 items-center rounded-full px-5 py-2 font-semibold text-base tracking-tight",
				TIER_CLASS[role] ?? TIER_CLASS.user,
			)}
		>
			{label}
		</span>
	);
}
