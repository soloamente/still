import { redirect } from "next/navigation";

/** Legacy route — banner and portrait live under Settings → Profile. */
export default function CustomizationPage() {
	redirect("/me/settings/profile");
}
