"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { useId, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";

export type StaffEditableProfile = {
	displayName: string | null;
	handle: string;
	bio: string | null;
	pronouns: string | null;
	location: string | null;
	website: string | null;
	bannerUrl: string | null;
	accentColor: string | null;
};

type FormState = {
	displayName: string;
	handle: string;
	bio: string;
	pronouns: string;
	location: string;
	website: string;
	bannerUrl: string;
	accentColor: string;
};

function toFormState(profile: StaffEditableProfile): FormState {
	return {
		displayName: profile.displayName ?? "",
		handle: profile.handle,
		bio: profile.bio ?? "",
		pronouns: profile.pronouns ?? "",
		location: profile.location ?? "",
		website: profile.website ?? "",
		bannerUrl: profile.bannerUrl ?? "",
		accentColor: profile.accentColor ?? "",
	};
}

function formToProfile(form: FormState): StaffEditableProfile {
	return {
		displayName: form.displayName.trim() || null,
		handle: form.handle.trim(),
		bio: form.bio.trim() || null,
		pronouns: form.pronouns.trim() || null,
		location: form.location.trim() || null,
		website: form.website.trim() || null,
		bannerUrl: form.bannerUrl.trim() || null,
		accentColor: form.accentColor.trim() || null,
	};
}

/**
 * Inline edit form for the eight profile fields staff with `user:edit` may
 * change on someone else's account. Submits to POST /api/staff/users/:id/edit;
 * the server returns `{ ok: true }` and audits which fields changed.
 */
export function StaffUserEditForm({
	userId,
	profile,
	onSaved,
	onCancel,
}: {
	userId: string;
	profile: StaffEditableProfile;
	onSaved: (profile: StaffEditableProfile) => void;
	onCancel: () => void;
}) {
	const [form, setForm] = useState<FormState>(() => toFormState(profile));
	const [saving, setSaving] = useState(false);
	const fieldIdBase = useId();
	const fieldIds = {
		displayName: `${fieldIdBase}-display-name`,
		handle: `${fieldIdBase}-handle`,
		pronouns: `${fieldIdBase}-pronouns`,
		location: `${fieldIdBase}-location`,
		website: `${fieldIdBase}-website`,
		bannerUrl: `${fieldIdBase}-banner-url`,
		accentColor: `${fieldIdBase}-accent-color`,
		bio: `${fieldIdBase}-bio`,
	} as const;

	function set<K extends keyof FormState>(key: K, value: FormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}

	async function handleSave() {
		setSaving(true);
		try {
			const payload = formToProfile(form);
			const res = await api.api.staff.users({ id: userId }).edit.post({
				displayName: payload.displayName ?? undefined,
				handle: payload.handle,
				bio: payload.bio ?? undefined,
				pronouns: payload.pronouns ?? undefined,
				location: payload.location ?? undefined,
				website: payload.website ?? undefined,
				bannerUrl: payload.bannerUrl ?? undefined,
				accentColor: payload.accentColor ?? undefined,
			});
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Could not save changes"));
				return;
			}
			onSaved(payload);
			toast.success("Profile updated");
		} catch (err) {
			toast.error(errorMessage(err, "Could not save changes"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-3">
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1 text-sm">
					<Label
						htmlFor={fieldIds.displayName}
						className="text-muted-foreground text-xs"
					>
						Display name
					</Label>
					<Input
						id={fieldIds.displayName}
						value={form.displayName}
						onChange={(e) => set("displayName", e.target.value)}
						maxLength={80}
					/>
				</div>
				<div className="space-y-1 text-sm">
					<Label
						htmlFor={fieldIds.handle}
						className="text-muted-foreground text-xs"
					>
						Handle
					</Label>
					<Input
						id={fieldIds.handle}
						value={form.handle}
						onChange={(e) => set("handle", e.target.value)}
						maxLength={24}
					/>
				</div>
				<div className="space-y-1 text-sm">
					<Label
						htmlFor={fieldIds.pronouns}
						className="text-muted-foreground text-xs"
					>
						Pronouns
					</Label>
					<Input
						id={fieldIds.pronouns}
						value={form.pronouns}
						onChange={(e) => set("pronouns", e.target.value)}
						maxLength={40}
					/>
				</div>
				<div className="space-y-1 text-sm">
					<Label
						htmlFor={fieldIds.location}
						className="text-muted-foreground text-xs"
					>
						Location
					</Label>
					<Input
						id={fieldIds.location}
						value={form.location}
						onChange={(e) => set("location", e.target.value)}
						maxLength={80}
					/>
				</div>
				<div className="space-y-1 text-sm">
					<Label
						htmlFor={fieldIds.website}
						className="text-muted-foreground text-xs"
					>
						Website
					</Label>
					<Input
						id={fieldIds.website}
						value={form.website}
						onChange={(e) => set("website", e.target.value)}
						maxLength={200}
					/>
				</div>
				<div className="space-y-1 text-sm">
					<Label
						htmlFor={fieldIds.bannerUrl}
						className="text-muted-foreground text-xs"
					>
						Banner URL
					</Label>
					<Input
						id={fieldIds.bannerUrl}
						value={form.bannerUrl}
						onChange={(e) => set("bannerUrl", e.target.value)}
						maxLength={1000}
					/>
				</div>
				<div className="space-y-1 text-sm">
					<Label
						htmlFor={fieldIds.accentColor}
						className="text-muted-foreground text-xs"
					>
						Accent color
					</Label>
					<Input
						id={fieldIds.accentColor}
						value={form.accentColor}
						onChange={(e) => set("accentColor", e.target.value)}
						maxLength={20}
						placeholder="#7c3aed"
					/>
				</div>
			</div>
			<div className="space-y-1 text-sm">
				<Label htmlFor={fieldIds.bio} className="text-muted-foreground text-xs">
					Bio
				</Label>
				<Textarea
					id={fieldIds.bio}
					value={form.bio}
					onChange={(e) => set("bio", e.target.value)}
					rows={3}
					maxLength={500}
				/>
			</div>
			<div className="flex gap-2">
				<Button type="button" size="sm" disabled={saving} onClick={handleSave}>
					{saving ? "Saving…" : "Save changes"}
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={saving}
					onClick={onCancel}
				>
					Cancel
				</Button>
			</div>
		</div>
	);
}
