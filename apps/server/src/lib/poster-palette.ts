import { Buffer } from "node:buffer";

import { Vibrant } from "node-vibrant/node";

/**
 * Per-film palette extracted from the TMDb poster (w342) for tinted chrome on
 * the movie page. Falls back to genre-based hex in the UI when these are null.
 */

export type PosterPalette = {
  /** Primary wash — usually Vibrant swatch */
  accent: string;
  /** Depth / secondary surfaces — DarkMuted or Muted */
  muted: string;
  /** Selection + focus ring: lightened until WCAG contrast vs theater black */
  foreground: string;
};

const THEATER_BG = "#020202";
const MIN_CONTRAST = 4.5;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").slice(0, 6);
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const linearize = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = linearize(r);
  const G = linearize(g);
  const B = linearize(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG 2.1 contrast ratio of two sRGB hex colors (typical UI text on bg). */
function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Lighten a color toward white until it reads on `--surface-theater` (#020202). */
function foregroundForDarkUi(accentCandidate: string): string {
  let c = accentCandidate;
  for (let step = 0; step < 28; step++) {
    if (contrastRatio(c, THEATER_BG) >= MIN_CONTRAST) return c;
    c = mixHex(c, "#ffffff", 0.14);
  }
  return "#e5e4e4";
}

/**
 * Fetch poster bytes and extract Vibrant / Muted swatches. Returns null on any
 * failure (network, decode, empty poster path) — callers keep genre fallback.
 */
export async function extractPosterPalette(posterUrl: string | null): Promise<PosterPalette | null> {
  if (!posterUrl?.trim()) return null;
  try {
    const res = await fetch(posterUrl, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok || !res.body) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null;

    const palette = await Vibrant.from(buf).getPalette();
    const vib = palette.Vibrant?.hex ?? palette.DarkVibrant?.hex;
    const muted =
      palette.DarkMuted?.hex ?? palette.Muted?.hex ?? palette.DarkVibrant?.hex;
    if (!vib || !muted) return null;

    return {
      accent: vib,
      muted,
      foreground: foregroundForDarkUi(vib),
    };
  } catch (err) {
    console.warn("[poster-palette] extraction failed:", posterUrl.slice(0, 64), err);
    return null;
  }
}
