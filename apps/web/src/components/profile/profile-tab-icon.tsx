"use client";

import { useEffect } from "react";

import { profilePatronAvatarImageUrl } from "@/lib/profile-avatar";

const TAB_ICON_PX = 32;

/**
 * The site favicon is a 256px icon, so the browser keeps that in the tab and
 * ignores a portrait link. Draw a small circle from the portrait and point the
 * tab icon at that instead.
 */
export function ProfileTabIcon({
	handle,
	hasImage,
}: {
	handle: string;
	hasImage: boolean;
}) {
	useEffect(() => {
		if (!hasImage || !handle.trim()) return;

		const image = new Image();
		let revoked = false;
		const links = [
			...document.querySelectorAll<HTMLLinkElement>(
				'link[rel="icon"], link[rel="shortcut icon"]',
			),
		];
		const primary = links[0];
		const previous = primary
			? {
					href: primary.href,
					type: primary.type,
					sizes: primary.sizes.value,
				}
			: null;

		image.onload = () => {
			if (revoked) return;
			const canvas = document.createElement("canvas");
			canvas.width = TAB_ICON_PX;
			canvas.height = TAB_ICON_PX;
			const context = canvas.getContext("2d");
			if (!context || image.naturalWidth === 0) return;
			const scale = Math.max(
				TAB_ICON_PX / image.naturalWidth,
				TAB_ICON_PX / image.naturalHeight,
			);
			const width = image.naturalWidth * scale;
			const height = image.naturalHeight * scale;
			// Circle, matching the profile portrait. Corners stay transparent.
			context.beginPath();
			context.arc(
				TAB_ICON_PX / 2,
				TAB_ICON_PX / 2,
				TAB_ICON_PX / 2,
				0,
				Math.PI * 2,
			);
			context.closePath();
			context.clip();
			context.drawImage(
				image,
				(TAB_ICON_PX - width) / 2,
				(TAB_ICON_PX - height) / 2,
				width,
				height,
			);
			const icon = primary ?? document.createElement("link");
			if (!icon.isConnected) {
				icon.rel = "icon";
				document.head.appendChild(icon);
			}
			icon.type = "image/png";
			icon.setAttribute("sizes", "32x32");
			try {
				icon.href = canvas.toDataURL("image/png");
			} catch {
				return;
			}
			for (const extra of links.slice(1)) extra.remove();
		};
		image.src = profilePatronAvatarImageUrl(handle);

		return () => {
			revoked = true;
			if (!primary || !previous) return;
			primary.href = previous.href;
			primary.type = previous.type;
			primary.setAttribute("sizes", previous.sizes);
		};
	}, [handle, hasImage]);

	return null;
}
