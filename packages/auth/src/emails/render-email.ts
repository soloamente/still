import { render } from "@react-email/render";
import type { ReactElement } from "react";

/** Render a React Email template to HTML + plain-text for Resend. */
export async function renderAuthEmail(
	element: ReactElement,
	subject: string,
): Promise<{ subject: string; html: string; text: string }> {
	const html = await render(element);
	const text = await render(element, { plainText: true });
	return { subject, html, text };
}
