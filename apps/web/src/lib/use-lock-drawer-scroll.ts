"use client";

import { useLenis } from "lenis/react";
import { useEffect } from "react";

/**
 * While a bottom sheet is open on Lenis-backed pages (e.g. movie detail), pause smooth
 * window scroll and lock `html`/`body` so wheel / trackpad stays inside the sheet.
 */
export function useLockDrawerScroll(open: boolean) {
	const lenis = useLenis();

	useEffect(() => {
		if (!open) return;

		lenis?.stop();

		const html = document.documentElement;
		const body = document.body;
		const prevHtmlOverflow = html.style.overflow;
		const prevBodyOverflow = body.style.overflow;
		const prevHtmlPaddingRight = html.style.paddingRight;
		const scrollbarGutter = window.innerWidth - html.clientWidth;

		html.style.overflow = "hidden";
		body.style.overflow = "hidden";
		if (scrollbarGutter > 0) {
			html.style.paddingRight = `${scrollbarGutter}px`;
		}

		return () => {
			lenis?.start();
			html.style.overflow = prevHtmlOverflow;
			body.style.overflow = prevBodyOverflow;
			html.style.paddingRight = prevHtmlPaddingRight;
		};
	}, [open, lenis]);
}
