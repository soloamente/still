import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/** Dark transactional shell — matches Sense in-app chrome, no marketing blocks. */
export function AuthEmailLayout({
	preview,
	title,
	children,
	ctaLabel,
	ctaHref,
	footer,
}: {
	preview: string;
	title: string;
	children: ReactNode;
	ctaLabel: string;
	ctaHref: string;
	footer: string;
}) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Body style={bodyStyle}>
				<Container style={containerStyle}>
					<Heading style={headingStyle}>{title}</Heading>
					<Section style={copyStyle}>{children}</Section>
					<Button href={ctaHref} style={buttonStyle}>
						{ctaLabel}
					</Button>
					<Text style={footerStyle}>{footer}</Text>
				</Container>
			</Body>
		</Html>
	);
}

const bodyStyle = {
	backgroundColor: "#0a0a0a",
	color: "#f5f5f5",
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;

const containerStyle = {
	margin: "0 auto",
	padding: "32px 24px",
	maxWidth: "480px",
} as const;

const headingStyle = {
	fontSize: "22px",
	fontWeight: "600",
	lineHeight: "1.3",
	margin: "0 0 16px",
} as const;

const copyStyle = {
	fontSize: "15px",
	lineHeight: "1.6",
	margin: "0 0 24px",
} as const;

const buttonStyle = {
	backgroundColor: "#f5f5f5",
	color: "#0a0a0a",
	borderRadius: "9999px",
	fontSize: "15px",
	fontWeight: "600",
	textDecoration: "none",
	textAlign: "center" as const,
	display: "block",
	padding: "12px 20px",
} as const;

const footerStyle = {
	fontSize: "13px",
	lineHeight: "1.5",
	color: "#a3a3a3",
	margin: "24px 0 0",
} as const;
