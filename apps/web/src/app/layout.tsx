import { Agentation } from "agentation";
import { DialRoot } from "dialkit";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "dialkit/styles.css";
import "pasito/styles.css";
import { Fraunces, Geist_Mono, Outfit } from "next/font/google";
import localFont from "next/font/local";

import "../index.css";
import Providers from "@/components/providers";
import {
	APP_METADATA_DEFAULT_TITLE,
	APP_METADATA_DESCRIPTION,
	APP_METADATA_TITLE_TEMPLATE,
	APP_NAME,
} from "@/lib/app-brand";
import {
	OG_DEFAULT_PATH,
	ogImageMetadataFields,
} from "@/lib/og/og-image-metadata";
import { getSiteOrigin } from "@/lib/site-origin";
import { buildThemeFlashGuardScript } from "@/lib/theme-flash-guard";

/**
 * UI sans: **SF Pro Rounded** from `public/fonts/SF_Pro_Rounded` (next/font `localFont`),
 * exposed as `--font-sf-pro-rounded`. **Outfit** stays on `--font-inter` as a webfont
 * fallback in `globals.css` (`--font-proxima-nova`).
 * Display headlines stay on **Fraunces** via `font-display`.
 */
const sfProRounded = localFont({
	src: [
		{
			path: "../../public/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Ultralight.otf",
			weight: "100",
			style: "normal",
		},
		{
			path: "../../public/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Thin.otf",
			weight: "200",
			style: "normal",
		},
		{
			path: "../../public/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Light.otf",
			weight: "300",
			style: "normal",
		},
		{
			path: "../../public/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Regular.otf",
			weight: "400",
			style: "normal",
		},
		{
			path: "../../public/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Medium.otf",
			weight: "500",
			style: "normal",
		},
		{
			path: "../../public/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Semibold.otf",
			weight: "600",
			style: "normal",
		},
		{
			path: "../../public/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Bold.otf",
			weight: "700",
			style: "normal",
		},
		{
			path: "../../public/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Heavy.otf",
			weight: "800",
			style: "normal",
		},
		{
			path: "../../public/fonts/SF_Pro_Rounded/SF-Pro-Rounded-Black.otf",
			weight: "900",
			style: "normal",
		},
	],
	variable: "--font-sf-pro-rounded",
	display: "swap",
});

const outfit = Outfit({
	variable: "--font-inter",
	subsets: ["latin"],
	display: "swap",
});

const fraunces = Fraunces({
	variable: "--font-fraunces",
	subsets: ["latin"],
	display: "swap",
	// Variable font: full wght range is included by default. We opt into the
	// optical-size axis so headlines pick up the display cut (looser tracking,
	// sharper terminals) and small captions stay readable.
	axes: ["opsz"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
	display: "swap",
});

export const metadata: Metadata = {
	metadataBase: new URL(getSiteOrigin()),
	title: {
		default: APP_METADATA_DEFAULT_TITLE,
		template: APP_METADATA_TITLE_TEMPLATE,
	},
	description: APP_METADATA_DESCRIPTION,
	applicationName: APP_NAME,
	openGraph: {
		type: "website",
		locale: "en_US",
		siteName: APP_NAME,
		title: APP_METADATA_DEFAULT_TITLE,
		description: APP_METADATA_DESCRIPTION,
		...ogImageMetadataFields(OG_DEFAULT_PATH).openGraph,
	},
	twitter: {
		card: "summary_large_image",
		title: APP_METADATA_DEFAULT_TITLE,
		description: APP_METADATA_DESCRIPTION,
		...ogImageMetadataFields(OG_DEFAULT_PATH).twitter,
	},
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#f2f2f2" },
		{ media: "(prefers-color-scheme: dark)", color: "#09090a" },
	],
};

/**
 * Root shell: fonts and palette classes on `<html>` (synced client-side after hydrate).
 */
export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	/* next/font puts `--font-inter` on whichever node gets `variable`; it must live on
	 * `<html>` so :root rules like `font-family: var(--font-sans)` resolve it (body-only
	 * vars are invisible to `html`, which broke the stack → Times New Roman fallbacks). */
	const htmlFontClass = `${sfProRounded.variable} ${outfit.variable} ${outfit.className} ${geistMono.variable} ${fraunces.variable}`;

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* Inline bootstrap — must not use next/script inside React tree (Next 16). */}
				<script
					id="still-theme-flash-guard"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: tiny inline bootstrap only
					dangerouslySetInnerHTML={{ __html: buildThemeFlashGuardScript() }}
				/>
			</head>
			<body className="bg-background text-foreground antialiased">
				{/* DialKit dev panel: sibling of app tree (does not wrap {children}). */}
				<Providers htmlFontClass={htmlFontClass}>{children}</Providers>
				{process.env.NODE_ENV === "development" ? <Agentation /> : null}
				<DialRoot />
			</body>
		</html>
	);
}
