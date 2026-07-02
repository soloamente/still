export type TasteSignatureConfidence = "low" | "medium" | "high";

export type TasteArchetype =
	| "forming"
	| "contrarian"
	| "genre-purist"
	| "dual-affinity"
	| "generous"
	| "selective"
	| "genre-led"
	| "eclectic"
	| "curator";

export type TastePerspective = "self" | "visitor";

/** Plain-language explainer for the archetype pill tooltip. */
export function tasteArchetypeDescription(
	archetype: TasteArchetype,
	perspective: TastePerspective = "visitor",
): string | null {
	const diary = perspective === "self" ? "your diary" : "their diary";
	const watchHistory =
		perspective === "self" ? "your watch history" : "their watch history";
	const spread =
		perspective === "self"
			? "You spread attention across many genres — no single lane."
			: "They spread attention across many genres — no single lane.";
	const wideDiary =
		perspective === "self" ? "A wide-ranging diary." : "A wide-ranging diary.";

	switch (archetype) {
		case "genre-purist":
			return perspective === "self"
				? `Most of what you log lives in one genre.\nSense reads genre tags from ${diary}.`
				: `Most of what they log lives in one genre.\nSense reads genre tags from ${diary}.`;
		case "dual-affinity":
			return perspective === "self"
				? `Two genres show up together more than any other pairing.\nThat duo defines ${watchHistory}.`
				: `Two genres show up together more than any other pairing.\nThat duo defines ${watchHistory}.`;
		case "genre-led":
			return perspective === "self"
				? "One genre leads, with a few others in steady rotation.\nA favorite lane, not a single-genre diary."
				: "One genre leads, with a few others in steady rotation.\nA favorite lane, not a single-genre diary.";
		case "eclectic":
			return `${spread}\n${wideDiary}`;
		case "forming":
		case "contrarian":
		case "generous":
		case "selective":
		case "curator":
			return null;
	}
}

/** Short patron-facing label for the detected taste archetype. */
export function tasteArchetypeLabel(archetype: TasteArchetype): string {
	switch (archetype) {
		case "forming":
			return "Forming";
		case "contrarian":
			return "Contrarian";
		case "genre-purist":
			return "Genre purist";
		case "dual-affinity":
			return "Dual affinity";
		case "generous":
			return "Generous rater";
		case "selective":
			return "Selective rater";
		case "genre-led":
			return "Genre-led";
		case "eclectic":
			return "Eclectic";
		case "curator":
			return "Curator";
	}
}

/** Whether the patron has a confident, patron-facing taste category for profile pills. */
export function shouldShowTasteArchetypePill(
	tasteSignature: TasteSignatureJson | null,
): tasteSignature is TasteSignatureJson & { archetype: TasteArchetype } {
	const archetype = tasteSignature?.archetype;
	const confidence = tasteSignature?.confidence ?? "low";
	if (archetype == null) return false;
	if (confidence === "low") return false;
	return (
		archetype !== "forming" &&
		archetype !== "contrarian" &&
		archetype !== "generous" &&
		archetype !== "selective" &&
		archetype !== "curator"
	);
}

export interface TasteSignatureJson {
	archetype?: TasteArchetype;
	headlineSelf?: string;
	headlineVisitor?: string;
	/** Backward compat — mirrors headlineSelf when dual fields exist */
	headline: string;
	confidence: TasteSignatureConfidence;
}

function capitalizeHeadline(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return trimmed;
	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Read-time fallback when cached rows only have legacy second-person headline.
 * Converts old "You gravitate…" templates into visitor voice with a leading capital.
 */
export function legacyVisitorHeadlineFromSelf(headlineSelf: string): string {
	const text = headlineSelf.trim();

	if (/^Sense is still learning your taste/i.test(text)) {
		return "Taste map still forming — not enough logs yet.";
	}
	if (/^Your taste map is still forming/i.test(text)) {
		return "Taste map still forming — not enough logs yet to describe a clear lens.";
	}

	// Legacy contrarian combo: "You gravitate toward X. You trust…"
	const gravitateContrarianTrust = text.match(
		/^You gravitate toward ([^.]+)\.\s*You trust your own read over the consensus — (.+) stands out\.?$/i,
	);
	if (gravitateContrarianTrust) {
		return capitalizeHeadline(
			`Gravitates toward ${gravitateContrarianTrust[1]} — trusts their own read over the consensus; ${gravitateContrarianTrust[2]} stands out.`,
		);
	}

	const gravitateContrarianHigh = text.match(
		/^You gravitate toward ([^.]+)\.\s*You often score higher than the crowd — (.+) is one example\.?$/i,
	);
	if (gravitateContrarianHigh) {
		return capitalizeHeadline(
			`Gravitates toward ${gravitateContrarianHigh[1]} — often scores higher than the crowd; ${gravitateContrarianHigh[2]} is one example.`,
		);
	}

	const gravitateCurator = text.match(
		/^You gravitate toward ([^—]+)— your diary reads like a curator, not a completionist\.?$/i,
	);
	if (gravitateCurator) {
		return capitalizeHeadline(
			`Gravitates toward ${gravitateCurator[1].trim()} — diary reads like a curator, not a checklist.`,
		);
	}

	const gravitateCuratorSpaced = text.match(
		/^You gravitate toward ([^—]+) — your diary reads like a curator, not a completionist\.?$/i,
	);
	if (gravitateCuratorSpaced) {
		return capitalizeHeadline(
			`Gravitates toward ${gravitateCuratorSpaced[1].trim()} — diary reads like a curator, not a checklist.`,
		);
	}

	const converted = text
		.replace(/^You gravitate toward/gi, "Gravitates toward")
		.replace(/^You often/g, "Often")
		.replace(/^You trust/g, "Trusts")
		.replace(/^You /, "")
		.replace(/^Your /, "Their ")
		.replace(/\.\s*You often/g, ". Often")
		.replace(/\.\s*You trust/g, ". Trusts")
		.replace(/\byour diary\b/gi, "this diary")
		.replace(/\byour taste\b/gi, "this taste")
		.replace(/\byour log\b/gi, "this log")
		.replace(/\byou\b/g, "they");

	return capitalizeHeadline(converted);
}

export function parseTasteSignatureJson(
	value: unknown,
): TasteSignatureJson | null {
	if (!value || typeof value !== "object") return null;
	const o = value as Record<string, unknown>;

	const headlineSelfRaw =
		typeof o.headlineSelf === "string" && o.headlineSelf.trim()
			? o.headlineSelf.trim()
			: typeof o.headline === "string" && o.headline.trim()
				? o.headline.trim()
				: null;
	if (!headlineSelfRaw) return null;

	const headlineVisitorRaw =
		typeof o.headlineVisitor === "string" && o.headlineVisitor.trim()
			? o.headlineVisitor.trim()
			: legacyVisitorHeadlineFromSelf(headlineSelfRaw);

	const confidence = o.confidence;
	const parsedConfidence: TasteSignatureConfidence =
		confidence === "low" || confidence === "medium" || confidence === "high"
			? confidence
			: "low";

	const archetype = o.archetype;
	const parsedArchetype: TasteArchetype | undefined =
		archetype === "forming" ||
		archetype === "contrarian" ||
		archetype === "genre-purist" ||
		archetype === "dual-affinity" ||
		archetype === "generous" ||
		archetype === "selective" ||
		archetype === "genre-led" ||
		archetype === "eclectic" ||
		archetype === "curator"
			? archetype
			: undefined;

	return {
		archetype: parsedArchetype,
		headlineSelf: headlineSelfRaw,
		headlineVisitor: capitalizeHeadline(headlineVisitorRaw),
		headline: headlineSelfRaw,
		confidence: parsedConfidence,
	};
}

/** Profile + OG — pick self vs visitor copy from cached taste signature. */
export function resolveTasteHeadline(
	tasteSignature: TasteSignatureJson | null,
	perspective: TastePerspective,
): string | null {
	if (!tasteSignature) return null;
	if (perspective === "visitor") {
		const visitor =
			tasteSignature.headlineVisitor?.trim() ||
			legacyVisitorHeadlineFromSelf(
				tasteSignature.headlineSelf ?? tasteSignature.headline,
			);
		return capitalizeHeadline(visitor);
	}
	return tasteSignature.headlineSelf?.trim() ?? tasteSignature.headline.trim();
}
