import Link from "next/link";
import type { ReactNode } from "react";

/** Known legal cross-links rendered inside policy paragraphs. */
export const LEGAL_INLINE_LINKS: { label: string; href: string }[] = [
	{ label: "Trust Center", href: "/trust" },
	{ label: "Cookie Policy", href: "/cookies" },
	{ label: "Privacy Policy", href: "/privacy" },
	{ label: "Terms of Service", href: "/terms" },
];

/**
 * Split plain policy text so known labels become in-page links.
 * Longest label wins when phrases overlap.
 */
export function renderLegalInlineLinks(text: string): ReactNode {
	const labels = [...LEGAL_INLINE_LINKS].sort(
		(a, b) => b.label.length - a.label.length,
	);
	const pattern = new RegExp(
		`(${labels.map((item) => escapeRegExp(item.label)).join("|")})`,
		"g",
	);
	const parts = text.split(pattern);
	const hrefByLabel = new Map(
		LEGAL_INLINE_LINKS.map((item) => [item.label, item.href]),
	);
	const seen = new Map<string, number>();

	return parts.map((part) => {
		const occurrence = seen.get(part) ?? 0;
		seen.set(part, occurrence + 1);
		const key = `${part}-${occurrence}`;

		const href = hrefByLabel.get(part);
		if (!href) {
			return <span key={key}>{part}</span>;
		}
		return (
			<Link
				key={key}
				href={href}
				className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
			>
				{part}
			</Link>
		);
	});
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
