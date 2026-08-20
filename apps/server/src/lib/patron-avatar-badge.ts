import type { StaffRole } from "@still/auth/permissions";
import type { PlanTierId } from "@still/plans";

import {
	type DiaryMetalTier,
	fetchDiaryLogCountsForUserIds,
	resolveDiaryMetalTier,
} from "./diary-metal-tier";
import {
	fetchPlanTiersForUserIds,
	planTierForUserId,
} from "./patron-plan-tier";
import {
	fetchStaffRolesForUserIds,
	staffRoleForUserId,
} from "./patron-staff-role";

/** Shared patron portrait badge fields hydrated across list surfaces. */
export type PatronAvatarBadgeFields = {
	diaryMetalTier: DiaryMetalTier | null;
	planTier: PlanTierId;
	staffRole: StaffRole | null;
};

/** One round-trip batch for diary metal, plan tier, and staff role maps. */
export async function fetchPatronAvatarBadgeMaps(userIds: readonly string[]) {
	const [logCounts, planTiers, staffRoles] = await Promise.all([
		fetchDiaryLogCountsForUserIds(userIds),
		fetchPlanTiersForUserIds(userIds),
		fetchStaffRolesForUserIds(userIds),
	]);
	return { logCounts, planTiers, staffRoles };
}

export function patronAvatarBadgeFields(
	userId: string,
	maps: Awaited<ReturnType<typeof fetchPatronAvatarBadgeMaps>>,
): PatronAvatarBadgeFields {
	return {
		diaryMetalTier: resolveDiaryMetalTier(maps.logCounts.get(userId) ?? 0),
		planTier: planTierForUserId(userId, maps.planTiers),
		staffRole: staffRoleForUserId(userId, maps.staffRoles),
	};
}
