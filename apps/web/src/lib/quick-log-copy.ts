import type { TvLogScope } from "@/lib/tv-watch-types";

/** Sheet title above the rating slider (new logs only — edit uses fixed copy). */
export function quickLogSheetHeading(opts: {
	isSeries: boolean;
	rewatch: boolean;
	logScope: TvLogScope;
}): string {
	if (opts.rewatch) {
		if (!opts.isSeries) return "How was this rewatch?";
		switch (opts.logScope) {
			case "episode":
				return "How was this episode rewatch?";
			case "season":
				return "How was this season rewatch?";
			default:
				return "How was this series rewatch?";
		}
	}
	if (opts.isSeries) return "How much did you like this show?";
	return "How much did you like this movie?";
}

/** Primary submit CTA — reflects first watch vs rewatch and TV scope. */
export function quickLogSubmitLabel(opts: {
	isSeries: boolean;
	rewatch: boolean;
	logScope: TvLogScope;
}): string {
	if (opts.rewatch) {
		if (!opts.isSeries) return "Log rewatch";
		switch (opts.logScope) {
			case "episode":
				return "Log episode again";
			case "season":
				return "Log season again";
			default:
				return "Log series again";
		}
	}
	if (!opts.isSeries) return "Add movie";
	switch (opts.logScope) {
		case "episode":
			return "Add episode";
		case "season":
			return "Add season";
		default:
			return "Add show";
	}
}
