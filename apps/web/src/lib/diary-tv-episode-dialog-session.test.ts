import { describe, expect, test } from "bun:test";

import {
	chooseDiaryTvPoster,
	completeDiaryTvDialogClose,
	type DiaryTvDialogSession,
	type DiaryTvDialogShow,
	diaryTvPosterCloseKind,
	dismissDiaryTvDialog,
	syncDiaryTvDialogToGrid,
} from "./diary-tv-episode-dialog-session";

const showA: DiaryTvDialogShow = {
	key: "tv:1",
	tmdbId: 1,
	title: "Show A",
	posterPath: "/a.jpg",
};
const showB: DiaryTvDialogShow = {
	key: "tv:2",
	tmdbId: 2,
	title: "Show B",
	posterPath: "/b.jpg",
};
const showC: DiaryTvDialogShow = {
	key: "tv:3",
	tmdbId: 3,
	title: "Show C",
	posterPath: null,
};

const closed: DiaryTvDialogSession = { phase: "closed" };

function lookup(key: string): DiaryTvDialogShow | null {
	if (key === showA.key) return showA;
	if (key === showB.key) return showB;
	if (key === showC.key) return showC;
	return null;
}

describe("chooseDiaryTvPoster", () => {
	test("opens the first poster", () => {
		expect(chooseDiaryTvPoster(closed, showA.key, lookup)).toEqual({
			phase: "open",
			show: showA,
		});
	});

	test("stays closed when the poster is not in the grid", () => {
		expect(chooseDiaryTvPoster(closed, "tv:missing", lookup)).toEqual(closed);
	});

	test("clicking the open poster starts the flight home and does not reopen", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		expect(chooseDiaryTvPoster(open, showA.key, lookup)).toEqual({
			phase: "closing",
			show: showA,
			nextKey: null,
		});
	});

	test("a second poster waits until the current flight home finishes", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		expect(chooseDiaryTvPoster(open, showB.key, lookup)).toEqual({
			phase: "closing",
			show: showA,
			nextKey: showB.key,
		});
	});

	test("a poster chosen during the flight home replaces the queued show", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		const closing = chooseDiaryTvPoster(open, showB.key, lookup);
		expect(chooseDiaryTvPoster(closing, showC.key, lookup)).toEqual({
			phase: "closing",
			show: showA,
			nextKey: showC.key,
		});
	});

	test("clicking the poster that is flying home cancels the queued show", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		const closing = chooseDiaryTvPoster(open, showB.key, lookup);
		expect(chooseDiaryTvPoster(closing, showA.key, lookup)).toEqual({
			phase: "closing",
			show: showA,
			nextKey: null,
		});
	});
});

describe("dismissDiaryTvDialog", () => {
	test("escape, scrim, and close start one close and do not reopen", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		const closing = dismissDiaryTvDialog(open);
		expect(closing).toEqual({
			phase: "closing",
			show: showA,
			nextKey: null,
		});
		expect(dismissDiaryTvDialog(closing)).toEqual(closing);
		expect(completeDiaryTvDialogClose(closing, lookup)).toEqual(closed);
	});

	test("dismiss during a queued switch drops the next poster", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		const closing = chooseDiaryTvPoster(open, showB.key, lookup);
		const dismissed = dismissDiaryTvDialog(closing);
		expect(dismissed).toEqual({
			phase: "closing",
			show: showA,
			nextKey: null,
		});
		expect(completeDiaryTvDialogClose(dismissed, lookup)).toEqual(closed);
	});

	test("dismiss on a closed session stays closed", () => {
		expect(dismissDiaryTvDialog(closed)).toEqual(closed);
	});
});

describe("completeDiaryTvDialogClose", () => {
	test("opens the queued poster only after the flight finishes", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		const closing = chooseDiaryTvPoster(open, showB.key, lookup);
		expect(completeDiaryTvDialogClose(closing, lookup)).toEqual({
			phase: "open",
			show: showB,
		});
	});

	test("closes when the queued poster has left the grid", () => {
		const closing: DiaryTvDialogSession = {
			phase: "closing",
			show: showA,
			nextKey: "tv:missing",
		};
		expect(completeDiaryTvDialogClose(closing, lookup)).toEqual(closed);
	});

	test("ignores a complete call that is not closing", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		expect(completeDiaryTvDialogClose(open, lookup)).toEqual(open);
		expect(completeDiaryTvDialogClose(closed, lookup)).toEqual(closed);
	});
});

describe("syncDiaryTvDialogToGrid", () => {
	test("keeps the dialog when the show is still in the grid", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		expect(syncDiaryTvDialogToGrid(open, new Set([showA.key]))).toEqual(open);
	});

	test("starts a close when the open show leaves so the dialog can fade", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		expect(syncDiaryTvDialogToGrid(open, new Set([showB.key]))).toEqual({
			phase: "closing",
			show: showA,
			nextKey: null,
		});
	});

	test("drops a queued show that left and keeps one that stayed", () => {
		const open = chooseDiaryTvPoster(closed, showA.key, lookup);
		const closing = chooseDiaryTvPoster(open, showB.key, lookup);
		expect(
			syncDiaryTvDialogToGrid(closing, new Set([showA.key, showC.key])),
		).toEqual({
			phase: "closing",
			show: showA,
			nextKey: null,
		});
		expect(
			syncDiaryTvDialogToGrid(closing, new Set([showA.key, showB.key])),
		).toEqual(closing);
	});
});

describe("diaryTvPosterCloseKind", () => {
	const fly = {
		reduceMotion: false,
		cellInGrid: true,
		cellConnected: true,
		hasOrigin: true,
		hasPose: true,
	};

	test("flies home when the cell is still there", () => {
		expect(diaryTvPosterCloseKind(fly)).toBe("fly");
	});

	test("fades when the show left the grid", () => {
		expect(diaryTvPosterCloseKind({ ...fly, cellInGrid: false })).toBe("fade");
	});

	test("fades when the cell ref is gone", () => {
		expect(diaryTvPosterCloseKind({ ...fly, cellConnected: false })).toBe(
			"fade",
		);
	});

	test("fades for reduced motion, a missing origin, or a missing pose", () => {
		expect(diaryTvPosterCloseKind({ ...fly, reduceMotion: true })).toBe("fade");
		expect(diaryTvPosterCloseKind({ ...fly, hasOrigin: false })).toBe("fade");
		expect(diaryTvPosterCloseKind({ ...fly, hasPose: false })).toBe("fade");
	});
});
