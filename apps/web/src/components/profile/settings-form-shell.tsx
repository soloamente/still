"use client";

import type { ReactNode } from "react";

import {
	SettingsFormProvider,
	type SettingsProfile,
	useSettingsForm,
} from "@/components/profile/settings-form-context";

function SettingsFormBody({ children }: { children: ReactNode }) {
	const { formRef, onSubmit } = useSettingsForm();
	return (
		<form ref={formRef} onSubmit={onSubmit}>
			{children}
		</form>
	);
}

/** Shared settings state + save bar across `/me/settings/*` sidebar routes. */
export function SettingsFormShell({
	profile,
	children,
}: {
	profile: SettingsProfile;
	children: ReactNode;
}) {
	return (
		<SettingsFormProvider profile={profile}>
			<SettingsFormBody>{children}</SettingsFormBody>
		</SettingsFormProvider>
	);
}
