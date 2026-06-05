import { redirect } from "next/navigation";

import { ME_ACCOUNT_SETTINGS_HOME_HREF } from "@/lib/me-account-nav";

export default function SettingsIndexPage() {
	redirect(ME_ACCOUNT_SETTINGS_HOME_HREF);
}
