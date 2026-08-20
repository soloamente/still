/**
 * Credential-safe classification for `DATABASE_URL` targets.
 * Used at boot to warn when local dev may keep a paid Neon branch awake.
 */

export type DatabaseTargetKind =
	| "local"
	| "development"
	| "production"
	| "unknown";

export type DatabaseTargetSummary = {
	kind: DatabaseTargetKind;
	/** Safe label for logs — never includes credentials or full URLs. */
	label: string;
	/** True when recurring local jobs can prevent Neon scale-to-zero. */
	warnRecurringJobs: boolean;
};

/** Strip credentials and query params; keep host + database name when parseable. */
export function sanitizeDatabaseHostLabel(connectionString: string): string {
	const trimmed = connectionString.trim();
	if (!trimmed) return "unset";

	try {
		const url = new URL(trimmed.replace(/^postgres(ql)?:\/\//, "https://"));
		const host = url.hostname || "unknown-host";
		const database = url.pathname.replace(/^\//, "") || "postgres";
		return `${host}/${database}`;
	} catch {
		// Non-URL shapes (e.g. some Hyperdrive strings) — avoid leaking secrets.
		if (trimmed.includes("@")) {
			const afterAt = trimmed.split("@").pop()?.split("?")[0]?.split("/")[0];
			return afterAt ? `postgres@${afterAt}` : "postgres-remote";
		}
		return "postgres-remote";
	}
}

/**
 * Classify a database target without printing secrets.
 * Neon hostnames containing `-pooler` or `.neon.tech` are treated as remote.
 */
export function classifyDatabaseTarget(
	connectionString: string | undefined,
	nodeEnv: string | undefined = process.env.NODE_ENV,
): DatabaseTargetSummary {
	const hostLabel = sanitizeDatabaseHostLabel(connectionString ?? "");
	const lower = hostLabel.toLowerCase();

	const isLocal =
		lower.includes("localhost") ||
		lower.includes("127.0.0.1") ||
		lower.includes("0.0.0.0") ||
		lower.startsWith("postgres/postgres");

	if (isLocal) {
		return {
			kind: "local",
			label: hostLabel,
			warnRecurringJobs: false,
		};
	}

	const isNeon = lower.includes(".neon.tech") || lower.includes("neon.tech");
	const isDevBranch =
		lower.includes("-dev") ||
		lower.includes("_dev") ||
		lower.includes("/dev") ||
		lower.includes("development");

	if (nodeEnv === "production") {
		return {
			kind: "production",
			label: isNeon ? `neon:${hostLabel}` : hostLabel,
			warnRecurringJobs: true,
		};
	}

	if (isDevBranch || nodeEnv === "development") {
		return {
			kind: "development",
			label: isNeon ? `neon-dev:${hostLabel}` : hostLabel,
			warnRecurringJobs: isNeon,
		};
	}

	return {
		kind: "unknown",
		label: hostLabel,
		warnRecurringJobs: isNeon,
	};
}

/** One-line boot log for operators — no credentials. */
export function formatDatabaseTargetBootLine(
	summary: DatabaseTargetSummary,
): string {
	return `[boot] Database target: ${summary.kind} (${summary.label})`;
}
