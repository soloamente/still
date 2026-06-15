import Link from "next/link";
import type { ReactNode } from "react";

/** Lightweight inline markdown — paragraphs, emphasis, links, inline code. */
function formatJournalInline(text: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
	let lastIndex = 0;
	let match = pattern.exec(text);

	while (match) {
		if (match.index > lastIndex) {
			nodes.push(text.slice(lastIndex, match.index));
		}

		if (match[2] && match[3]) {
			const href = match[3].trim();
			const isExternal = /^https?:\/\//i.test(href);
			if (isExternal) {
				nodes.push(
					<a
						key={`${match.index}-link`}
						href={href}
						className="text-foreground underline decoration-foreground/30 underline-offset-2"
						target="_blank"
						rel="noopener noreferrer"
					>
						{match[2]}
					</a>,
				);
			} else {
				nodes.push(
					<Link
						key={`${match.index}-link`}
						href={href}
						className="text-foreground underline decoration-foreground/30 underline-offset-2"
					>
						{match[2]}
					</Link>,
				);
			}
		} else if (match[4]) {
			nodes.push(
				<strong key={`${match.index}-strong`} className="font-semibold">
					{match[4]}
				</strong>,
			);
		} else if (match[5]) {
			nodes.push(
				<code
					key={`${match.index}-code`}
					className="rounded-md bg-background px-1 py-0.5 font-mono text-[0.9em]"
				>
					{match[5]}
				</code>,
			);
		}

		lastIndex = match.index + match[0].length;
		match = pattern.exec(text);
	}

	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex));
	}

	return nodes;
}

/** Render staff-authored Journal copy stored as Markdown strings. */
export function JournalMarkdownBody({ body }: { body: string }) {
	const blocks = body.trim().split(/\n{2,}/);

	return (
		<div className="space-y-4 text-pretty text-foreground/90 text-sm leading-relaxed sm:text-base">
			{blocks.map((block) => {
				const trimmed = block.trim();
				if (!trimmed) return null;
				const blockKey = trimmed.slice(0, 48);

				if (trimmed.startsWith("## ")) {
					return (
						<h3
							key={`heading-${blockKey}`}
							className="text-balance font-semibold text-foreground text-lg tracking-tight"
						>
							{formatJournalInline(trimmed.slice(3))}
						</h3>
					);
				}

				return (
					<p key={`paragraph-${blockKey}`}>{formatJournalInline(trimmed)}</p>
				);
			})}
		</div>
	);
}
