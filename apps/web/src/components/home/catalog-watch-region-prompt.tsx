"use client";

import { Button } from "@still/ui/components/button";
import { Label } from "@still/ui/components/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { CATALOG_WATCH_REGION_OPTIONS } from "@/lib/catalog-watch-region-options";
import { PROFILE_PREF_CATALOG_TMDB_WATCH_REGION } from "@/lib/profile-preferences";

/**
 * First-run prompt on `/home`: signed-in patrons who have not saved
 * **`catalogTmdbWatchRegion`** yet choose a TMDb `watch_region` (or “all regions”) for
 * subscription streaming rails — same key is edited under **Settings**.
 */
export function CatalogWatchRegionPrompt({ open }: { open: boolean }) {
	const router = useRouter();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [country, setCountry] = useState("US");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		const el = dialogRef.current;
		if (!el) return;
		if (open) {
			if (!el.open) el.showModal();
		} else if (el.open) {
			el.close();
		}
	}, [open]);

	async function persist(value: string) {
		setBusy(true);
		try {
			await api.api.profiles.me.patch({
				preferences: { [PROFILE_PREF_CATALOG_TMDB_WATCH_REGION]: value },
			});
			toast.success(
				value === "ALL"
					? "Streaming catalogues will follow all regions."
					: "Catalogue region saved.",
			);
			router.refresh();
		} catch (err) {
			console.error(err);
			toast.error("Could not save — try Account settings.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<dialog
			ref={dialogRef}
			className="fixed top-1/2 left-1/2 z-50 w-[min(100%,24rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/55"
			aria-labelledby="catalog-watch-region-title"
		>
			<div className="space-y-4">
				<div className="space-y-1.5">
					<h2
						id="catalog-watch-region-title"
						className="font-sans font-semibold text-lg tracking-tight"
					>
						Streaming catalogue region
					</h2>
					<p className="text-muted-foreground text-sm leading-relaxed">
						“At home” rows use TMDb subscription availability in a{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs">
							watch_region
						</code>
						. Pick where you subscribe, choose{" "}
						<span className="font-medium text-foreground">All regions</span> for
						a global slice, or change this any time in{" "}
						<Link
							href="/me/settings"
							className="font-medium text-foreground underline-offset-4 hover:underline"
						>
							Settings
						</Link>
						.
					</p>
				</div>
				<div className="space-y-2">
					<Label htmlFor="catalog-watch-region-select">Country / region</Label>
					<select
						id="catalog-watch-region-select"
						value={country}
						onChange={(e) => setCountry(e.target.value)}
						className="h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
						disabled={busy}
					>
						{CATALOG_WATCH_REGION_OPTIONS.map(({ value, label }) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
					<Button
						type="button"
						variant="outline"
						size="pill"
						className="w-full sm:w-auto"
						disabled={busy}
						onClick={() => void persist("ALL")}
					>
						All regions
					</Button>
					<Button
						type="button"
						variant="accent"
						size="pill"
						className="w-full sm:w-auto"
						disabled={busy}
						onClick={() => void persist(country)}
					>
						Save region
					</Button>
				</div>
			</div>
		</dialog>
	);
}
