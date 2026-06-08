import { roleLabel, roleWithArticle } from "@/lib/staff-role-labels";

export type RoleChangeDirection = "promoted" | "demoted";

export interface RoleChangeDialogCopy {
	title: string;
	headline: string;
	subtext: string;
	pillLabel: string;
	showStaffPanelCta: boolean;
}

export function roleChangeDialogCopy(
	direction: RoleChangeDirection,
	newRole: string,
): RoleChangeDialogCopy {
	const pillLabel = roleLabel(newRole);
	if (direction === "promoted") {
		return {
			title: "It's official!",
			headline: `You're now ${roleWithArticle(newRole)}`,
			subtext: "You've got new staff permissions on Still.",
			pillLabel,
			showStaffPanelCta: true,
		};
	}
	if (newRole === "user") {
		return {
			title: "Your role has changed",
			headline: "You no longer have staff access.",
			subtext: "",
			pillLabel,
			showStaffPanelCta: false,
		};
	}
	return {
		title: "Your role has changed",
		headline: `You're now ${roleWithArticle(newRole)}`,
		subtext: "Some staff tools are no longer available to you.",
		pillLabel,
		showStaffPanelCta: false,
	};
}
