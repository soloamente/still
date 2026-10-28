import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

/**
 * Visual tone of the single call-to-action.
 * `danger` is reserved for irreversible actions (account deletion).
 */
export type AuthEmailTone = "default" | "danger";

/** CTA colours per tone. `Record` keeps the map exhaustive when a tone is added. */
const TONE_STYLES: Record<
	AuthEmailTone,
	{ ctaBackground: string; ctaColor: string }
> = {
	// Same white pill as the in-app primary action (`bg-foreground text-background`).
	default: { ctaBackground: "#ffffff", ctaColor: "#1c1c1c" },
	// White on #c7372f measures ~5.2:1 — passes AA for the 16px semibold label.
	danger: { ctaBackground: "#c7372f", ctaColor: "#ffffff" },
};

/**
 * Dark transactional shell — mirrors Sense in-app chrome: a deeper page floor,
 * one raised card, the wordmark pill on a lifted inset, and a single white
 * primary pill. No marketing blocks, no remote images (nothing to be blocked).
 */
export function AuthEmailLayout({
	preview,
	title,
	kicker,
	children,
	ctaLabel,
	ctaHref,
	expires,
	footer,
	tone = "default",
}: {
	/** Inbox preheader text shown next to the subject line. */
	preview: string;
	title: string;
	/** Short context label top-right of the card, e.g. "Verify email". */
	kicker: string;
	children: ReactNode;
	ctaLabel: string;
	ctaHref: string;
	/** Human duration, e.g. "24 hours" — rendered as "This link expires in …". */
	expires: string;
	footer: string;
	tone?: AuthEmailTone;
}) {
	const toneStyle = TONE_STYLES[tone];
	return (
		<Html dir="ltr" lang="en">
			<Head>
				{/* The design is dark-only; tell clients not to auto-invert it. */}
				<meta content="dark" name="color-scheme" />
				<meta content="dark" name="supported-color-schemes" />
			</Head>
			<Preview>{preview}</Preview>
			<Body style={bodyStyle}>
				<Container style={containerStyle}>
					<Section style={cardStyle}>
						{/* Brand row: wordmark pill left, context kicker right. */}
						{/* Decorative chrome: skipped in the plain-text part (where the cells
						    would otherwise fuse into "SenseVerify email"). */}
						<table
							cellPadding={0}
							data-skip-in-text="true"
							cellSpacing={0}
							role="presentation"
							style={brandRowStyle}
							width="100%"
						>
							<tbody>
								<tr>
									<td align="left" style={{ verticalAlign: "middle" }}>
										<span style={wordmarkStyle}>Sense</span>
									</td>
									<td align="right" style={kickerCellStyle}>
										{kicker}
									</td>
								</tr>
							</tbody>
						</table>

						<Heading as="h1" style={headingStyle}>
							{title}
						</Heading>
						<Section style={copyStyle}>{children}</Section>

						<Button
							href={ctaHref}
							style={{
								...buttonStyle,
								backgroundColor: toneStyle.ctaBackground,
								color: toneStyle.ctaColor,
							}}
						>
							{ctaLabel}
						</Button>
						<Text style={expiryStyle}>This link expires in {expires}.</Text>

						{/* Copyable fallback — some clients rewrite or block buttons. Skipped in
						    plain text: there the CTA already prints the raw URL. */}
						<Section data-skip-in-text="true" style={fallbackStyle}>
							<Text style={fallbackLabelStyle}>
								Button not working? Paste this link into your browser:
							</Text>
							<Link href={ctaHref} style={fallbackLinkStyle}>
								{ctaHref}
							</Link>
						</Section>
					</Section>

					<Text style={footerStyle}>{footer}</Text>
					<Text style={signatureStyle}>
						Sense · where your taste feels real
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

// Palette derived from the app's neutral ladder (canvas → raised → inset).
const COLORS = {
	floor: "#141414",
	raised: "#1c1c1c",
	inset: "#252525",
	text: "#d4d4d4",
	textMuted: "#8d8d8d",
	white: "#ffffff",
} as const;

/**
 * Shared body paragraph — templates use this so copy reads the same everywhere.
 * `muted` steps secondary lines back without changing weight (no layout shift).
 */
export function AuthEmailParagraph({
	children,
	muted = false,
}: {
	children: ReactNode;
	muted?: boolean;
}) {
	return (
		<Text
			style={{
				margin: "0 0 12px",
				color: muted ? COLORS.textMuted : COLORS.text,
			}}
		>
			{children}
		</Text>
	);
}

// Inter first (matches the app), then system UIs — email clients rarely ship Inter.
const FONT_STACK =
	'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const bodyStyle: CSSProperties = {
	backgroundColor: COLORS.floor,
	color: COLORS.text,
	fontFamily: FONT_STACK,
	margin: 0,
	padding: "32px 12px",
	// Stops iOS from inflating text in landscape.
	WebkitTextSizeAdjust: "100%",
};

const containerStyle: CSSProperties = {
	margin: "0 auto",
	maxWidth: "520px",
	width: "100%",
};

const cardStyle: CSSProperties = {
	backgroundColor: COLORS.raised,
	borderRadius: "28px",
	padding: "28px 32px 32px",
};

const brandRowStyle: CSSProperties = {
	marginBottom: "40px",
};

const wordmarkStyle: CSSProperties = {
	display: "inline-block",
	backgroundColor: COLORS.inset,
	borderRadius: "9999px",
	color: COLORS.white,
	fontSize: "15px",
	fontWeight: 600,
	letterSpacing: "-0.01em",
	lineHeight: "1",
	padding: "10px 16px",
};

const kickerCellStyle: CSSProperties = {
	color: COLORS.textMuted,
	fontSize: "13px",
	lineHeight: "1.4",
	verticalAlign: "middle",
};

const headingStyle: CSSProperties = {
	color: COLORS.white,
	fontSize: "30px",
	fontWeight: 600,
	letterSpacing: "-0.02em",
	lineHeight: "1.15",
	margin: "0 0 16px",
};

const copyStyle: CSSProperties = {
	fontSize: "16px",
	lineHeight: "1.6",
	margin: "0 0 28px",
};

const buttonStyle: CSSProperties = {
	borderRadius: "9999px",
	boxSizing: "border-box",
	display: "block",
	fontSize: "16px",
	fontWeight: 600,
	lineHeight: "1",
	padding: "17px 24px",
	textAlign: "center",
	textDecoration: "none",
	width: "100%",
};

const expiryStyle: CSSProperties = {
	color: COLORS.textMuted,
	fontSize: "13px",
	lineHeight: "1.5",
	margin: "14px 0 28px",
	textAlign: "center",
};

const fallbackStyle: CSSProperties = {
	backgroundColor: COLORS.inset,
	borderRadius: "16px",
	padding: "14px 16px",
};

const fallbackLabelStyle: CSSProperties = {
	color: COLORS.textMuted,
	fontSize: "13px",
	lineHeight: "1.5",
	margin: "0 0 6px",
};

const fallbackLinkStyle: CSSProperties = {
	color: COLORS.text,
	fontSize: "13px",
	lineHeight: "1.5",
	// Long signed URLs must wrap instead of widening the card on phones.
	wordBreak: "break-all",
	textDecoration: "underline",
};

const footerStyle: CSSProperties = {
	color: COLORS.textMuted,
	fontSize: "13px",
	lineHeight: "1.6",
	margin: "24px 16px 0",
	textAlign: "center",
};

const signatureStyle: CSSProperties = {
	color: COLORS.textMuted,
	fontSize: "13px",
	lineHeight: "1.5",
	margin: "10px 0 0",
	textAlign: "center",
};
