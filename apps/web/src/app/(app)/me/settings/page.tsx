import { SettingsForm } from "@/components/profile/settings-form";
import { serverApi } from "@/lib/server-api";

export default async function SettingsPage() {
	const api = await serverApi();
	const me = await api.api.profiles.me.get().catch(() => ({ data: null }));

	if (!me.data) {
		return null;
	}

	return <SettingsForm profile={me.data} />;
}
