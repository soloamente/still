/** Server `autoLog` field on POST /api/companion/now-watching. */
export type CompanionAutoLogReport = {
	status: "pending" | "logged" | "unmatched" | "failed" | "skipped";
	reason?: "no_match" | "no_episode" | "not_ready" | "write" | "recent";
	timing?: "early" | "late";
};

export type CompanionAutologErrorNotice = {
	type: "sense-companion:autolog-error";
	title: string;
	titleUrl: string | null;
	senseHomeUrl: string;
	report: CompanionAutoLogReport;
};

export type AutologErrorToastCopy = {
	headline: string;
	body: string;
	actionLabel: string;
	/** Screen reader label for the whole notice. */
	ariaLabel: string;
	variant: "error" | "info";
};

const AUTOLOG_ERROR_DEDUPE_PREFIX = "still:companion-autolog-error:v2:";

/** Stable per-title key so we toast once per failure mode. */
export function autologErrorDedupeKey(input: {
	report: CompanionAutoLogReport;
	title: string;
	season: number | null;
	episode: number | null;
}): string {
	const title = input.title.trim().toLowerCase();
	const episode =
		input.season != null && input.episode != null
			? `s${input.season}e${input.episode}`
			: "";
	return [
		input.report.status,
		input.report.reason ?? "",
		input.report.timing ?? "",
		title,
		episode,
	].join("\0");
}

export function autologErrorDedupeStorageKey(dedupeKey: string): string {
	return `${AUTOLOG_ERROR_DEDUPE_PREFIX}${dedupeKey}`;
}

export function readCompanionAutoLogReport(
	value: unknown,
): CompanionAutoLogReport | null {
	if (typeof value !== "object" || value === null) return null;
	const row = value as {
		status?: unknown;
		reason?: unknown;
		timing?: unknown;
	};
	if (
		row.status !== "pending" &&
		row.status !== "logged" &&
		row.status !== "unmatched" &&
		row.status !== "failed" &&
		row.status !== "skipped"
	) {
		return null;
	}
	const report: CompanionAutoLogReport = { status: row.status };
	if (
		row.reason === "no_match" ||
		row.reason === "no_episode" ||
		row.reason === "not_ready" ||
		row.reason === "write" ||
		row.reason === "recent"
	) {
		report.reason = row.reason;
	}
	if (row.timing === "early" || row.timing === "late") {
		report.timing = row.timing;
	}
	return report;
}

export function readCompanionAutologErrorNotice(
	value: unknown,
): CompanionAutologErrorNotice | null {
	if (typeof value !== "object" || value === null) return null;
	const row = value as {
		type?: unknown;
		title?: unknown;
		titleUrl?: unknown;
		senseHomeUrl?: unknown;
		report?: unknown;
	};
	if (row.type !== "sense-companion:autolog-error") return null;
	if (typeof row.title !== "string" || row.title.length === 0) return null;
	if (typeof row.senseHomeUrl !== "string" || row.senseHomeUrl.length === 0) {
		return null;
	}
	const report = readCompanionAutoLogReport(row.report);
	if (!report) return null;
	const titleUrl =
		typeof row.titleUrl === "string" && row.titleUrl.startsWith("https://")
			? row.titleUrl
			: null;
	return {
		type: "sense-companion:autolog-error",
		title: row.title,
		titleUrl,
		senseHomeUrl: row.senseHomeUrl,
		report,
	};
}

/** Option A patron copy for each auto-log failure mode. */
export function autologErrorToastCopy(
	notice: CompanionAutologErrorNotice,
): AutologErrorToastCopy | null {
	const title = notice.title;
	const report = notice.report;
	if (!shouldShowAutologErrorToast(report)) return null;

	switch (report.status) {
		case "unmatched": {
			if (report.reason === "no_episode") {
				return {
					headline: "Didn’t auto-log — need season and episode",
					body: `Sense needs a season and episode number to log ${title}. This player didn’t send enough detail.`,
					actionLabel: "Log on Sense",
					ariaLabel: `Auto-log failed. Season and episode required for ${title}.`,
					variant: "error",
				};
			}
			if (report.reason === "no_match" && report.timing === "early") {
				return {
					headline: "Couldn’t match this to Sense",
					body: `${title} isn’t in our catalogue from this page. Auto-log won’t run for this watch.`,
					actionLabel: "Log it yourself",
					ariaLabel: `Couldn’t match ${title} to Sense. Auto-log won’t run.`,
					variant: "error",
				};
			}
			return {
				headline: "Didn’t auto-log — title not found",
				body: `We couldn’t find ${title} in Sense, so nothing was added to your diary.`,
				actionLabel: "Log on Sense",
				ariaLabel: `Auto-log failed. Title not found in Sense for ${title}.`,
				variant: "error",
			};
		}
		case "failed":
			return {
				headline: "Didn’t auto-log — save failed",
				body: `We matched ${title}, but Sense couldn’t save your watch right now. Try again later or log it yourself.`,
				actionLabel: "Log on Sense",
				ariaLabel: `Auto-log failed. Could not save ${title} to your diary.`,
				variant: "error",
			};
		case "skipped":
			if (report.reason === "recent") {
				return {
					headline: "Already in your diary",
					body: `You logged ${title} recently. Auto-log skipped so you don’t get a duplicate.`,
					actionLabel: "Dismiss",
					ariaLabel: `${title} was already logged recently. Auto-log skipped.`,
					variant: "info",
				};
			}
			return null;
		default: {
			const _exhaustive: never = report.status;
			return _exhaustive;
		}
	}
}

export function autologErrorActionHref(
	notice: CompanionAutologErrorNotice,
): string {
	if (notice.report.reason === "recent") {
		return notice.senseHomeUrl;
	}
	return notice.titleUrl ?? notice.senseHomeUrl;
}

export function shouldShowAutologErrorToast(
	report: CompanionAutoLogReport,
): boolean {
	if (report.status === "logged" || report.status === "pending") return false;
	if (report.status === "skipped" && report.reason !== "recent") return false;
	return true;
}

export function shouldHideAutologCountdownForReport(
	report: CompanionAutoLogReport,
): boolean {
	return (
		report.status === "unmatched" &&
		(report.reason === "no_match" || report.reason === "no_episode")
	);
}

/** Countdown only after Sense confirms a catalogue match (pending), not while unknown. */
export function isAutologCountdownEligible(
	report: CompanionAutoLogReport | null,
): boolean {
	if (report == null) return false;
	switch (report.status) {
		case "pending":
			return true;
		case "logged":
		case "unmatched":
		case "failed":
		case "skipped":
			return false;
		default: {
			const _exhaustive: never = report.status;
			return _exhaustive;
		}
	}
}

export type PopupAutologHint = "unknown" | "eligible" | "unmatched" | "recent";

export function popupAutologHintFromReport(
	report: CompanionAutoLogReport | null,
): PopupAutologHint {
	if (report == null) return "unknown";
	if (report.status === "pending") return "eligible";
	if (report.status === "skipped" && report.reason === "recent") {
		return "recent";
	}
	if (report.status === "unmatched" || report.status === "failed") {
		return "unmatched";
	}
	return "unknown";
}

export function readWatchResultAutoLog(
	value: unknown,
): CompanionAutoLogReport | null {
	if (typeof value !== "object" || value === null) return null;
	const row = value as { type?: unknown; autoLog?: unknown };
	if (row.type !== "sense-companion:watch-result") return null;
	return readCompanionAutoLogReport(row.autoLog);
}
