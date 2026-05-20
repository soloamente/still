import { redirect } from "next/navigation";

import { MeAccountShell } from "@/components/profile/me-account-shell";
import { authServer } from "@/lib/auth-server";
import { serverApi } from "@/lib/server-api";

export default async function MeLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await authServer();
	if (!session) {
		redirect("/sign-in");
	}

	const api = await serverApi();
	const me = await api.api.profiles.me.get().catch(() => ({ data: null }));

	if (!me.data) {
		redirect("/onboarding");
	}

	const handle = me.data.handle;

	return <MeAccountShell handle={handle}>{children}</MeAccountShell>;
}
