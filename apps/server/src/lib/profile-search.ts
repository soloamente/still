/** Relationship tier for sorting profile search hits (lower = higher in list). */
export type ProfileSearchRelationship = "mutual" | "following" | "none";

export interface ProfileSearchCandidate {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	isFollowing: boolean;
	isMutual: boolean;
}

export interface ProfileSearchHit {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	relationship: ProfileSearchRelationship;
}

export function normalizeProfileSearchQuery(raw: string): string {
	return raw.trim().replace(/^@+/, "").trim().toLowerCase();
}

export function relationshipFromFollow(
	isFollowing: boolean,
	isMutual: boolean,
): ProfileSearchRelationship {
	if (isFollowing && isMutual) return "mutual";
	if (isFollowing) return "following";
	return "none";
}

function relationshipSortTier(relationship: ProfileSearchRelationship): number {
	if (relationship === "mutual") return 0;
	if (relationship === "following") return 1;
	return 2;
}

/** Handle prefix beats display-name-only; following/mutual tiers beat strangers. */
export function rankProfileSearchHits(
	rows: ProfileSearchCandidate[],
	query: string,
): ProfileSearchHit[] {
	const q = query.toLowerCase();
	return rows
		.map((row) => {
			const relationship = relationshipFromFollow(
				row.isFollowing,
				row.isMutual,
			);
			const handleLower = row.handle.toLowerCase();
			const nameLower = row.displayName.toLowerCase();
			const handlePrefix = handleLower.startsWith(q);
			const nameMatch =
				nameLower.startsWith(q) || (q.length >= 2 && nameLower.includes(q));
			return {
				userId: row.userId,
				handle: row.handle,
				displayName: row.displayName,
				image: row.image,
				relationship,
				_sortTier: relationshipSortTier(relationship),
				_handlePrefix: handlePrefix ? 0 : 1,
				_nameOnly: handlePrefix || nameMatch ? 0 : 1,
				_handleLen: handleLower.length,
			};
		})
		.filter((row) => row._nameOnly === 0 || row._handlePrefix === 0)
		.sort((a, b) => {
			if (a._sortTier !== b._sortTier) return a._sortTier - b._sortTier;
			if (a._handlePrefix !== b._handlePrefix) {
				return a._handlePrefix - b._handlePrefix;
			}
			if (a._handleLen !== b._handleLen) return a._handleLen - b._handleLen;
			return a.handle.localeCompare(b.handle);
		})
		.map(({ userId, handle, displayName, image, relationship }) => ({
			userId,
			handle,
			displayName,
			image,
			relationship,
		}));
}
