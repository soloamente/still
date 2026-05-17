import { Agentation } from "agentation";
import { DialRoot } from "dialkit";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "dialkit/styles.css";
import { Fraunces, Geist_Mono, Outfit } from "next/font/google";
import localFont from "next/font/local";

import "../index.css";
import Providers from "@/components/providers";

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
	title: {
		default: "Still — your cinematic memory",
		template: "%s · Still",
	},
	description:
		"Log every film you watch, rate it, share it. A modern social home for cinephiles — diaries, reviews, lists, chat, and badges.",
	applicationName: "Still",
};

export const viewport: Viewport = {
	themeColor: "#09090a",
	colorScheme: "dark",
};

/**
 * Root shell: fonts, theme (`dark`), optional cinema atmosphere preset.
 * `NEXT_PUBLIC_CINEMA_PRESET=multiplex` → faster ticker, heavier grain (see `globals.css`).
 */
export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	/* next/font puts `--font-inter` on whichever node gets `variable`; it must live on
	 * `<html>` so :root rules like `font-family: var(--font-sans)` resolve it (body-only
	 * vars are invisible to `html`, which broke the stack → Times New Roman fallbacks). */
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${sfProRounded.variable} ${outfit.variable} ${outfit.className} ${geistMono.variable} ${fraunces.variable} dark`}
			data-cinema-preset={
				process.env.NEXT_PUBLIC_CINEMA_PRESET === "multiplex"
					? "multiplex"
					: "arthouse"
			}
		>
			<body className="bg-background text-foreground antialiased">
				{/* DialKit dev panel: sibling of app tree (does not wrap {children}). */}
				<Providers>{children}</Providers>
				{process.env.NODE_ENV === "development" ? <Agentation /> : null}
				<DialRoot />
			</body>
		</html>
	);
}
