import { redirect } from "next/navigation";

/** Legacy route — film search lives in the sticky search dialog on lobby pages. */
export default function SearchPage() {
	redirect("/home");
}
