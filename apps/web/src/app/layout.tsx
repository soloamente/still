import { Agentation } from "agentation";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "pasito/styles.css";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";

import "../index.css";
import { ThemeFlashGuardScript } from "@/components/app/theme-flash-guard-script";
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

/**
 * UI sans: **Inter** via next/font → `--font-inter` → `font-sans` in `globals.css`.
 * Display headlines stay on **Fraunces** via `font-display`.
 */
const inter = Inter({
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

export async function generateMetadata(): Promise<Metadata> {
	const requestHeaders = await headers();

	return {
		// Resolve `/og/*` and other relative metadata against the web host serving this page.
		metadataBase: new URL(getSiteOrigin(requestHeaders)),
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
}

export const viewport: Viewport = {
	// Extend the page canvas under the notch / home indicator on iOS Safari.
	viewportFit: "cover",
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
	const htmlFontClass = `${inter.variable} ${inter.className} ${geistMono.variable} ${fraunces.variable}`;

	return (
		<html lang="en" suppressHydrationWarning>
			<body className="bg-background text-foreground antialiased">
				<ThemeFlashGuardScript />
				<Providers htmlFontClass={htmlFontClass}>{children}</Providers>
				{process.env.NODE_ENV === "development" ? <Agentation /> : null}
			</body>
		</html>
	);
}
