import { CustomizationForm } from "@/components/profile/customization-form";
import { authServer } from "@/lib/auth-server";
import { serverApi } from "@/lib/server-api";

export default async function CustomizationPage() {
	const session = await authServer();
	const api = await serverApi();
	const me = await api.api.profiles.me.get().catch(() => ({ data: null }));

	if (!me.data) {
		return null;
	}

	const displayName = me.data.displayName?.trim() || me.data.handle;

	return (
		<CustomizationForm
			profile={me.data}
			hasAvatar={Boolean(session?.user.image?.trim())}
			displayName={displayName}
		/>
	);
}
