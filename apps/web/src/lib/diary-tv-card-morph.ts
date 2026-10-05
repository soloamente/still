/**
 * The diary TV dialog is a card that starts as the tapped poster and grows
 * into the full rectangle. The poster stays a poster on top of that card and
 * settles into the left slot. Content fades in once the card is open.
 */

export interface DiaryTvCardBox {
	left: number;
	top: number;
	width: number;
	height: number;
	radius: number;
}

export interface DiaryTvCardMorph {
	card: DiaryTvCardBox;
	/** Poster box, relative to the card's top-left. */
	poster: DiaryTvCardBox;
	contentOpacity: number;
	cardOpacity: number;
	duration: number;
}

/** Poster covers the whole card, so the first frame is only the poster. */
export function morphFromCell(cell: DiaryTvCardBox): DiaryTvCardMorph {
	return {
		card: cell,
		poster: {
			left: 0,
			top: 0,
			width: cell.width,
			height: cell.height,
			radius: cell.radius,
		},
		contentOpacity: 0,
		cardOpacity: 1,
		duration: 0,
	};
}

/** Slot rect in viewport coordinates, expressed inside the card. */
export function posterBoxInsideCard(
	card: DiaryTvCardBox,
	slot: DiaryTvCardBox,
): DiaryTvCardBox {
	return {
		left: slot.left - card.left,
		top: slot.top - card.top,
		width: slot.width,
		height: slot.height,
		radius: slot.radius,
	};
}

/** Card is the dialog rectangle. Poster sits in the left slot. Content may show. */
export function morphToPanel(
	panel: DiaryTvCardBox,
	poster: DiaryTvCardBox,
	duration = 0.45,
): DiaryTvCardMorph {
	return {
		card: panel,
		poster,
		contentOpacity: 1,
		cardOpacity: 1,
		duration,
	};
}

/** Shrink back onto the cell. The poster fills the card again. Content is gone. */
export function morphHome(
	cell: DiaryTvCardBox,
	duration = 0.45,
): DiaryTvCardMorph {
	return { ...morphFromCell(cell), duration };
}

/** Missing cell: hold the card where it is and fade. Do not fly. */
export function morphFade(current: DiaryTvCardMorph): DiaryTvCardMorph {
	return {
		...current,
		contentOpacity: 0,
		cardOpacity: 0,
		duration: 0.2,
	};
}
