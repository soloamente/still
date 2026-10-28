import { syncAutologCountdownPill } from "./autolog-countdown-view";
import {
	autologErrorDedupeKey,
	autologErrorDedupeStorageKey,
	type CompanionAutoLogReport,
	isAutologCountdownEligible,
	readCompanionAutologErrorNotice,
	shouldHideAutologCountdownForReport,
	shouldShowAutologErrorToast,
} from "./autolog-error-notice";
import { showAutologErrorToast } from "./autolog-error-toast-view";

/** Last server verdict for the title on this tab. */
let autologCatalogueEligible = false;

export function resetAutologCatalogueEligibility(): void {
	autologCatalogueEligible = false;
}

export function autologCountdownAllowed(): boolean {
	return autologCatalogueEligible;
}

/** Sync countdown + popup eligibility from a heartbeat `autoLog` field. */
export function applyCompanionAutoLogReport(
	report: CompanionAutoLogReport | null,
): void {
	autologCatalogueEligible = isAutologCountdownEligible(report);
	if (
		!autologCatalogueEligible &&
		report != null &&
		shouldHideAutologCountdownForReport(report)
	) {
		syncAutologCountdownPill({ phase: "hidden", remainingSec: null });
	}
}

/** Apply server auto-log status: hide countdown when needed, toast once. */
export function handleCompanionAutologErrorMessage(value: unknown): void {
	const notice = readCompanionAutologErrorNotice(value);
	if (!notice) return;
	const report = notice.report;
	applyCompanionAutoLogReport(report);

	if (!shouldShowAutologErrorToast(report)) return;

	const dedupeKey = autologErrorDedupeKey({
		report,
		title: notice.title,
		season: null,
		episode: null,
	});
	const storageKey = autologErrorDedupeStorageKey(dedupeKey);
	try {
		if (sessionStorage.getItem(storageKey) === "1") return;
	} catch {
		// Private mode — still show the toast, but skip dedupe persistence.
	}

	showAutologErrorToast(notice);

	try {
		sessionStorage.setItem(storageKey, "1");
	} catch {
		// Private mode.
	}
}

/** Show a toast when the tab already has `autoLog` from a watch-result. */
export function notifyCompanionAutologFromHeartbeat(input: {
	report: CompanionAutoLogReport;
	title: string;
	titleUrl: string | null;
	senseHomeUrl: string;
}): void {
	handleCompanionAutologErrorMessage(buildCompanionAutologErrorNotice(input));
}

/** Port payload the background worker forwards to the streaming tab. */
export function buildCompanionAutologErrorNotice(input: {
	report: CompanionAutoLogReport;
	title: string;
	titleUrl: string | null;
	senseHomeUrl: string;
}) {
	return {
		type: "sense-companion:autolog-error" as const,
		title: input.title,
		titleUrl: input.titleUrl,
		senseHomeUrl: input.senseHomeUrl,
		report: input.report,
	};
}
