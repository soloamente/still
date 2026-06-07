"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

type AuditEntry = {
	id: string;
	actorId: string;
	action: string;
	targetType: string;
	targetId: string;
	reason?: string | null;
	createdAt?: string | null;
};

function formatDate(value?: string | null): string {
	if (!value) return "";
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

/**
 * Audit tab: read-only list of recent staff actions. Owner/admin-only (the
 * parent only mounts this for those roles; the server enforces `audit:read`
 * independently). Mirrors the app's `api.api.*` + local-state fetch pattern.
 */
export function StaffAuditTab() {
	const [entries, setEntries] = useState<AuditEntry[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await api.api.staff.audit.get({ query: { limit: "100" } });
				if (cancelled) return;
				if (res.error) {
					toast.error("Could not load audit log");
					return;
				}
				const data = res.data as { entries?: AuditEntry[] } | null;
				setEntries(data?.entries ?? []);
			} catch {
				if (!cancelled) toast.error("Could not load audit log");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<section className="mb-10">
			<h2 className="mb-3 font-medium text-lg">Audit log</h2>
			{loading ? (
				<p className="text-muted-foreground text-sm">Loading…</p>
			) : entries.length === 0 ? (
				<p className="text-muted-foreground text-sm">No audit entries.</p>
			) : (
				<ul className="divide-y divide-border rounded-md border border-border">
					{entries.map((entry) => (
						<li key={entry.id} className="px-4 py-3 text-sm">
							<div className="flex flex-wrap items-baseline gap-x-2">
								<span className="font-medium">{entry.action}</span>
								<span className="text-muted-foreground text-xs">
									{entry.targetType}:{entry.targetId}
								</span>
								<span className="ml-auto text-muted-foreground text-xs">
									{formatDate(entry.createdAt)}
								</span>
							</div>
							{entry.reason ? (
								<p className="mt-1 text-muted-foreground text-xs">
									{entry.reason}
								</p>
							) : null}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
