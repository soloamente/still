import { env } from "@still/env/web";

/** Logo.dev image options — see https://www.logo.dev/docs/logo-images/get */
export type LogoDevLogoUrlOptions = {
	width?: number;
	height?: number;
	format?: "png" | "webp" | "jpg";
	theme?: "auto" | "light" | "dark";
	retina?: boolean;
	fallback?: "monogram" | "404";
};

function logoDevPublishableKey(): string | null {
	const token = env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
	return token?.trim() ? token.trim() : null;
}

/** True when Logo.dev CDN URLs can be built in the browser bundle. */
export function logoDevPublishableKeyConfigured(): boolean {
	return logoDevPublishableKey() != null;
}

function appendLogoDevParams(
	params: URLSearchParams,
	opts: LogoDevLogoUrlOptions,
): void {
	const token = logoDevPublishableKey();
	if (!token) return;
	params.set("token", token);
	params.set("format", opts.format ?? "png");
	params.set("theme", opts.theme ?? "dark");
	if (opts.retina !== false) params.set("retina", "true");
	if (opts.width != null) params.set("width", String(opts.width));
	if (opts.height != null) params.set("height", String(opts.height));
	if (opts.fallback) params.set("fallback", opts.fallback);
}

/**
 * Logo.dev CDN URL by company name (`name/Netflix`).
 * Returns null when the publishable key is unset — callers fall back to TMDb art.
 */
export function logoDevCompanyNameLogoUrl(
	companyName: string,
	opts: LogoDevLogoUrlOptions = {},
): string | null {
	const token = logoDevPublishableKey();
	const name = companyName.trim();
	if (!token || !name) return null;
	const params = new URLSearchParams();
	appendLogoDevParams(params, opts);
	return `https://img.logo.dev/name/${encodeURIComponent(name)}?${params.toString()}`;
}

/**
 * Logo.dev CDN URL by domain (`netflix.com`) — often sharper than name lookup.
 */
export function logoDevDomainLogoUrl(
	domain: string,
	opts: LogoDevLogoUrlOptions = {},
): string | null {
	const token = logoDevPublishableKey();
	const host =
		domain
			.trim()
			.replace(/^https?:\/\//i, "")
			.split("/")[0] ?? "";
	if (!token || !host) return null;
	const params = new URLSearchParams();
	appendLogoDevParams(params, opts);
	return `https://img.logo.dev/${encodeURIComponent(host)}?${params.toString()}`;
}
