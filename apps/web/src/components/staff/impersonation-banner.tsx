"use client";

import { Button } from "@still/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";

/**
 * Sticky banner shown across the app while a staff member is impersonating
 * another account (via POST /api/staff/users/:id/impersonate). Lets them end
 * the session in one click; the server attributes the resulting audit entry
 * to the real staff member via `session.impersonatedBy`, not this account.
 */
export function ImpersonationBanner({ name }: { name: string }) {
	const [stopping, setStopping] = useState(false);

	async function handleStop() {
		setStopping(true);
		try {
			const res = await api.api.staff["stop-impersonating"].post();
			if (res.error) {
				toast.error(
					errorMessage(res.error.value, "Could not stop impersonating"),
				);
				return;
			}
			toast.success("Stopped impersonating");
			window.location.href = "/staff";
		} catch (err) {
			toast.error(errorMessage(err, "Could not stop impersonating"));
		} finally {
			setStopping(false);
		}
	}

	return (
		<div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-amber-950 text-sm">
			<span>
				You&apos;re impersonating <strong>{name}</strong>.
			</span>
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="border-amber-950/30 bg-transparent text-amber-950 hover:bg-amber-950/10"
				disabled={stopping}
				onClick={handleStop}
			>
				{stopping ? "Stopping…" : "Stop impersonating"}
			</Button>
		</div>
	);
}
