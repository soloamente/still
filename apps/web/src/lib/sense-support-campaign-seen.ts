const SENSE_SUPPORT_CAMPAIGN_SEEN_PREFIX =
	"still:sense-support-campaign-seen:v1:";

function storageKey(userId: string): string {
	return `${SENSE_SUPPORT_CAMPAIGN_SEEN_PREFIX}${userId}`;
}

function hasStorage(): boolean {
	return typeof globalThis.localStorage !== "undefined";
}

/** Last campaign id this patron acknowledged (null when unseen or unavailable). */
export function readSenseSupportCampaignSeenId(userId: string): string | null {
	if (!hasStorage()) return null;
	try {
		const raw = globalThis.localStorage.getItem(storageKey(userId));
		if (!raw) return null;
		const trimmed = raw.trim();
		return trimmed.length > 0 ? trimmed : null;
	} catch {
		return null;
	}
}

export function markSenseSupportCampaignSeen(
	userId: string,
	campaignId: string,
): void {
	if (!hasStorage()) return;
	try {
		globalThis.localStorage.setItem(storageKey(userId), campaignId);
	} catch {
		// Private mode / quota — dialog may reappear; non-fatal.
	}
}

export function shouldShowSenseSupportCampaign(
	userId: string,
	campaignId: string,
): boolean {
	return readSenseSupportCampaignSeenId(userId) !== campaignId;
}
