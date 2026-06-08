"use client";

import { useCallback, useEffect, useState } from "react";

import { RoleChangeDialog } from "@/components/staff/role-change-dialog";
import { api } from "@/lib/api";
import type { RoleChangeDirection } from "@/lib/role-change-dialog-copy";
import { postNotificationRead } from "@/lib/still-api-fetch";

const OPEN_DELAY_MS = 500;

type Pending = {
	id: string;
	direction: RoleChangeDirection;
	newRole: string;
};

/** Shows the role-change dialog once when the user has an unread role change. */
export function RoleChangeDialogRoot() {
	const [pending, setPending] = useState<Pending | null>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await api.api.notifications["role-change"].get();
				if (cancelled || res.error) return;
				const row = res.data?.notification;
				if (!row) return;
				const payload = (row.payload ?? {}) as Record<string, unknown>;
				const direction = payload.direction;
				const newRole = payload.newRole;
				if (
					(direction !== "promoted" && direction !== "demoted") ||
					typeof newRole !== "string"
				) {
					return;
				}
				setPending({ id: row.id, direction, newRole });
				window.setTimeout(() => {
					if (!cancelled) setOpen(true);
				}, OPEN_DELAY_MS);
			} catch {
				// Non-fatal — it can surface next load.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const dismiss = useCallback(() => {
		setOpen(false);
		const id = pending?.id;
		if (id) {
			void postNotificationRead(id);
		}
	}, [pending]);

	if (!pending) return null;

	return (
		<RoleChangeDialog
			open={open}
			direction={pending.direction}
			newRole={pending.newRole}
			onDismiss={dismiss}
		/>
	);
}
