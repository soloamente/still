import { redirect } from "next/navigation";

/** Legacy route — the Imports tab became Data (import + export + danger zone). */
export default function SettingsImportsPage() {
	redirect("/me/settings/data");
}
