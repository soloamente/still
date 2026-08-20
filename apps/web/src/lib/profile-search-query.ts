import type { PlanTierId } from "@still/plans";

import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import type { StaffRole } from "@/lib/staff-role-labels";

/** Patron row from `GET /api/profiles/search`. */
export type ProfileSearchRelationship = "mutual" | "following" | "none";

export interface ProfileSearchHit {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	planTier: PlanTierId;
	staffRole: StaffRole | null;
	relationship: ProfileSearchRelationship;
}

/** Strip leading `@` and whitespace before profile typeahead requests. */
export function normalizeProfileSearchQuery(raw: string): string {
	return raw.trim().replace(/^@+/, "").trim();
}
