"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";

import { StaffUserDetail } from "./staff-user-detail";

type StaffUser = {
	id: string;
	name?: string | null;
	email?: string | null;
	image?: string | null;
	role?: string | null;
	banned?: boolean | null;
	banExpires?: string | null;
	createdAt?: string | null;
};

const ASSIGNABLE_ROLES = [
	"user",
	"support",
	"moderator",
	"admin",
	"owner",
] as const;

/**
 * Users tab: search + ban/unban + (owner-only) role assignment. Mirrors the
 * app's data pattern (`api.api.*` with `res.data`/`res.error`, local state, and
 * `sonner` toasts) — the web app does not wire TanStack Query, so we manage
 * loading/refresh by hand.
 */
export function StaffUsersTab({ currentRole }: { currentRole: string }) {
	const canModerate = currentRole === "owner" || currentRole === "admin";
	const canSetRole = currentRole === "owner";

	const [query, setQuery] = useState("");
	const [users, setUsers] = useState<StaffUser[]>([]);
	const [loading, setLoading] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	// Incremented on every load request; only the response matching the
	// latest token is committed, so out-of-order responses (e.g. a slow
	// earlier search resolving after a faster later one) are ignored.
	const requestTokenRef = useRef(0);

	const load = useCallback(async (q: string) => {
		const token = ++requestTokenRef.current;
		setLoading(true);
		try {
			const res = await api.api.staff.users.get({ query: { q } });
			if (requestTokenRef.current !== token) return;
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Could not load users"));
				return;
			}
			const data = res.data as { users?: StaffUser[] } | null;
			setUsers(data?.users ?? []);
		} catch {
			if (requestTokenRef.current === token) {
				toast.error("Could not load users");
			}
		} finally {
			if (requestTokenRef.current === token) {
				setLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		const handle = setTimeout(() => {
			void load(query.trim());
		}, 250);
		return () => clearTimeout(handle);
	}, [query, load]);

	async function handleBan(target: StaffUser) {
		setBusyId(target.id);
		try {
			const res = await api.api.staff
				.users({ id: target.id })
				.ban.post({ reason: undefined, expiresInSeconds: undefined });
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Could not ban user"));
				return;
			}
			toast.success("User banned");
			await load(query.trim());
		} catch {
			toast.error("Could not ban user");
		} finally {
			setBusyId(null);
		}
	}

	async function handleUnban(target: StaffUser) {
		setBusyId(target.id);
		try {
			const res = await api.api.staff.users({ id: target.id }).unban.post();
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Could not unban user"));
				return;
			}
			toast.success("User unbanned");
			await load(query.trim());
		} catch {
			toast.error("Could not unban user");
		} finally {
			setBusyId(null);
		}
	}

	async function handleSetRole(target: StaffUser, role: string) {
		if (role === (target.role ?? "user")) return;
		setBusyId(target.id);
		try {
			const res = await api.api.staff
				.users({ id: target.id })
				.role.post({ role: role as (typeof ASSIGNABLE_ROLES)[number] });
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Could not change role"));
				return;
			}
			toast.success("Role updated");
			await load(query.trim());
		} catch {
			toast.error("Could not change role");
		} finally {
			setBusyId(null);
		}
	}

	return (
		<section className="mb-10">
			<h2 className="mb-3 font-medium text-lg">Users</h2>
			<Input
				type="search"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Search by name or email"
				className="mb-4 max-w-sm"
			/>

			{loading && users.length === 0 ? (
				<p className="text-muted-foreground text-sm">Loading…</p>
			) : users.length === 0 ? (
				<p className="text-muted-foreground text-sm">No users found.</p>
			) : (
				<ul className="divide-y divide-border rounded-md border border-border">
					{users.map((u) => {
						const role = u.role ?? "user";
						const busy = busyId === u.id;
						return (
							<li key={u.id}>
								<div className="flex flex-wrap items-center gap-3 px-4 py-3">
									<button
										type="button"
										className="min-w-0 flex-1 text-left"
										aria-expanded={expandedId === u.id}
										onClick={() =>
											setExpandedId((prev) => (prev === u.id ? null : u.id))
										}
									>
										<p className="truncate font-medium text-sm">
											{u.name || "Unnamed"}
											{u.banned ? (
												<span className="ml-2 font-normal text-destructive text-xs">
													banned
												</span>
											) : null}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{u.email} · {role}
										</p>
									</button>

									{canSetRole ? (
										<select
											value={role}
											disabled={busy}
											onChange={(e) => void handleSetRole(u, e.target.value)}
											className="h-8 rounded-md border border-input bg-muted/40 px-2 text-sm outline-none disabled:opacity-60"
											aria-label={`Set role for ${u.email}`}
										>
											{ASSIGNABLE_ROLES.map((r) => (
												<option key={r} value={r}>
													{r}
												</option>
											))}
										</select>
									) : null}

									{canModerate ? (
										u.banned ? (
											<Button
												variant="outline"
												size="sm"
												disabled={busy}
												onClick={() => void handleUnban(u)}
											>
												Unban
											</Button>
										) : (
											<Button
												variant="destructive"
												size="sm"
												disabled={busy}
												onClick={() => void handleBan(u)}
											>
												Ban
											</Button>
										)
									) : null}
								</div>

								{expandedId === u.id ? (
									<StaffUserDetail
										userId={u.id}
										canEdit={canModerate}
										canNote={canModerate}
										canPro={canModerate}
										canImpersonate={canSetRole}
									/>
								) : null}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
