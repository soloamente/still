/** Style keys mirrored from the textarea so caret measurement matches rendered lines. */
const TEXTAREA_MIRROR_PROPERTIES = [
	"direction",
	"boxSizing",
	"width",
	"height",
	"overflowX",
	"overflowY",
	"borderTopWidth",
	"borderRightWidth",
	"borderBottomWidth",
	"borderLeftWidth",
	"borderStyle",
	"paddingTop",
	"paddingRight",
	"paddingBottom",
	"paddingLeft",
	"fontStyle",
	"fontVariant",
	"fontWeight",
	"fontStretch",
	"fontSize",
	"lineHeight",
	"fontFamily",
	"textAlign",
	"textTransform",
	"textIndent",
	"letterSpacing",
	"wordSpacing",
	"tabSize",
] as const;

export type TextareaCaretViewportAnchor = {
	x: number;
	y: number;
	height: number;
};

/**
 * Viewport coordinates for an `@` mention popover — anchored to the caret inside
 * a `<textarea>` (accounts for scroll + padding).
 */
export function measureTextareaCaretViewportAnchor(
	textarea: HTMLTextAreaElement,
	position: number,
): TextareaCaretViewportAnchor {
	const doc = textarea.ownerDocument;
	const win = doc.defaultView;
	if (!win) return { x: 0, y: 0, height: 16 };

	const mirror = doc.createElement("div");
	const computed = win.getComputedStyle(textarea);

	mirror.setAttribute("aria-hidden", "true");
	mirror.style.position = "absolute";
	mirror.style.visibility = "hidden";
	mirror.style.whiteSpace = "pre-wrap";
	mirror.style.wordWrap = "break-word";
	mirror.style.overflow = "hidden";
	mirror.style.top = "0";
	mirror.style.left = "-9999px";

	for (const prop of TEXTAREA_MIRROR_PROPERTIES) {
		mirror.style.setProperty(prop, computed.getPropertyValue(prop));
	}

	mirror.style.width = `${textarea.offsetWidth}px`;

	const value = textarea.value;
	mirror.textContent = value.slice(0, position);
	const marker = doc.createElement("span");
	marker.textContent = value.slice(position) || ".";
	mirror.appendChild(marker);
	doc.body.appendChild(mirror);

	const borderTop = Number.parseFloat(computed.borderTopWidth) || 0;
	const borderLeft = Number.parseFloat(computed.borderLeftWidth) || 0;
	const relativeTop = marker.offsetTop + borderTop - textarea.scrollTop;
	const relativeLeft = marker.offsetLeft + borderLeft - textarea.scrollLeft;
	const height =
		marker.offsetHeight || Number.parseFloat(computed.lineHeight) || 16;

	doc.body.removeChild(mirror);

	const textareaRect = textarea.getBoundingClientRect();
	return {
		x: textareaRect.left + relativeLeft,
		y: textareaRect.top + relativeTop,
		height,
	};
}
