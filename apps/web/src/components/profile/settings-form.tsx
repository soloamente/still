"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { useState } from "react";
import { toast } from "sonner";

import { useCinematicAudio } from "@/components/cinema/sound-provider";
import { api } from "@/lib/api";
import { CATALOG_WATCH_REGION_OPTIONS } from "@/lib/catalog-watch-region-options";
import {
	PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER,
	PROFILE_PREF_CATALOG_TMDB_WATCH_REGION,
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";

/** Deep merge isn’t promised — PATCH `/profiles/me` shallow-merges one level so new keys never erase legacy prefs blobs. */

type Me = {
	handle: string;
	displayName: string;
	bio: string | null;
	pronouns: string | null;
	location: string | null;
	website: string | null;
	isPrivate: boolean;
	preferences?: Record<string, unknown> | null;
} | null;

export function SettingsForm({ initial }: { initial: Me }) {
	const { setTheaterAudioEnabled } = useCinematicAudio();
	const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
	const [bio, setBio] = useState(initial?.bio ?? "");
	const [pronouns, setPronouns] = useState(initial?.pronouns ?? "");
	const [location, setLocation] = useState(initial?.location ?? "");
	const [website, setWebsite] = useState(initial?.website ?? "");
	const [isPrivate, setIsPrivate] = useState(Boolean(initial?.isPrivate));
	const [theaterAudio, setTheaterAudio] = useState(
		Boolean(initial?.preferences?.theaterAudio === true),
	);
	const [catalogMonochromePeersOnHover, setCatalogMonochromePeersOnHover] =
		useState(() =>
			readCatalogMonochromePeersOnHoverPref(initial?.preferences ?? null),
		);
	const [catalogTmdbWatchRegion, setCatalogTmdbWatchRegion] = useState(() => {
		const p = readCatalogTmdbWatchRegionPref(initial?.preferences ?? null);
		if (p === null) return "";
		return p === "ALL" ? "ALL" : p;
	});
	const [saving, setSaving] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			const prefs = {
				...(initial?.preferences ?? {}),
				theaterAudio,
				[PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER]:
					catalogMonochromePeersOnHover,
				...(catalogTmdbWatchRegion.trim() !== ""
					? {
							[PROFILE_PREF_CATALOG_TMDB_WATCH_REGION]: catalogTmdbWatchRegion,
						}
					: {}),
			};

			await api.api.profiles.me.patch({
				displayName: displayName.trim(),
				bio: bio.trim() || undefined,
				pronouns: pronouns.trim() || undefined,
				location: location.trim() || undefined,
				website: website.trim() || undefined,
				isPrivate,
				preferences: prefs,
			});
			setTheaterAudioEnabled(theaterAudio);
			toast.success("Saved");
		} catch (err) {
			console.error(err);
			toast.error("Couldn't save");
		} finally {
			setSaving(false);
		}
	}

	return (
		<form onSubmit={submit} className="space-y-5">
			<div className="space-y-2">
				<Label htmlFor="displayName">Name</Label>
				<Input
					id="displayName"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
					required
					maxLength={120}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="bio">Bio</Label>
				<Textarea
					id="bio"
					rows={4}
					value={bio}
					onChange={(e) => setBio(e.target.value)}
					maxLength={600}
				/>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="pronouns">Pronouns</Label>
					<Input
						id="pronouns"
						value={pronouns}
						onChange={(e) => setPronouns(e.target.value)}
						maxLength={40}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="location">Location</Label>
					<Input
						id="location"
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						maxLength={80}
					/>
				</div>
			</div>
			<div className="space-y-2">
				<Label htmlFor="website">Website</Label>
				<Input
					id="website"
					type="url"
					value={website}
					onChange={(e) => setWebsite(e.target.value)}
					placeholder="https://"
				/>
			</div>
			<label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/40 px-4 py-3 text-muted-foreground text-sm leading-snug">
				{/* Checkbox aligns with kiosk toggles — entire row clickable so we meet hit-target guidance. */}
				<input
					type="checkbox"
					checked={isPrivate}
					onChange={(e) => setIsPrivate(e.target.checked)}
					className="mt-0.5 accent-desert-orange"
				/>
				<span>
					Private profile — only approved followers can see your activity
				</span>
			</label>
			<div className="rounded-2xl border border-desert-orange/30 bg-desert-orange/5 px-4 py-4">
				<label className="flex cursor-pointer items-start gap-3 text-foreground text-sm leading-snug">
					<input
						type="checkbox"
						checked={theaterAudio}
						onChange={(e) => setTheaterAudio(e.target.checked)}
						className="mt-1 accent-desert-orange"
					/>
					<span className="space-y-1">
						<span className="font-medium text-foreground">
							Theater audio (experimental)
						</span>
						<span className="block text-muted-foreground">
							Projector hum on film detail pages plus a reel clack when you
							finish logging — mute automatically if you prefer reduced motion.
							Disabled by default; nothing autoplays without a gesture from you.
						</span>
					</span>
				</label>
			</div>
			<div className="space-y-2">
				<Label htmlFor="catalogTmdbWatchRegion">Catalogue region (TMDb)</Label>
				<select
					id="catalogTmdbWatchRegion"
					value={catalogTmdbWatchRegion}
					onChange={(e) => setCatalogTmdbWatchRegion(e.target.value)}
					className="h-11 w-full max-w-md rounded-xl border border-input bg-background px-3 text-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
				>
					<option value="">Not set yet (home will ask once)</option>
					<option value="ALL">All regions</option>
					{CATALOG_WATCH_REGION_OPTIONS.map(({ value, label }) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
				</select>
				<p className="text-muted-foreground text-xs leading-relaxed">
					Subscription “At home” lists use this as the TMDb watch region. “In
					cinemas” on Home and Discover uses the same country for theatrical
					release dates when you pick a code (not “All regions”). TMDb also uses
					this locale for catalogue and detail posters when a regional variant
					exists. Leave unset to choose on first visit.
				</p>
			</div>
			<div className="rounded-2xl border border-border/70 bg-card/40 px-4 py-4">
				<label className="flex cursor-pointer items-start gap-3 text-foreground text-sm leading-snug">
					<input
						type="checkbox"
						checked={catalogMonochromePeersOnHover}
						onChange={(e) => setCatalogMonochromePeersOnHover(e.target.checked)}
						className="mt-1 accent-desert-orange"
					/>
					<span className="space-y-1">
						<span className="font-medium text-foreground">
							Home lobby — monochrome neighbors on hover
						</span>
						<span className="block text-muted-foreground">
							On the home catalogue, posters you are not pointing at turn
							grayscale while one title is hovered so the focused poster reads
							clearer. Turn off if you prefer every tile to stay in full color.
						</span>
					</span>
				</label>
			</div>
			<div className="flex justify-end">
				<Button type="submit" variant="accent" size="pill" disabled={saving}>
					Save
				</Button>
			</div>
		</form>
	);
}
