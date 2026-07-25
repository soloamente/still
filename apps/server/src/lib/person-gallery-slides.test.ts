import { describe, expect, test } from "bun:test";

import { buildPersonGallerySlides } from "./person-gallery-slides";

describe("buildPersonGallerySlides", () => {
	test("prefers landscape tagged stills and labels with media title", () => {
		const slides = buildPersonGallerySlides({
			personName: "Tom Hanks",
			heroProfilePath: "/hero.jpg",
			taggedImages: [
				{
					file_path: "/portrait-tag.jpg",
					aspect_ratio: 0.67,
					vote_average: 9,
					media: { title: "Cast Away" },
				},
				{
					file_path: "/wide-tag.jpg",
					aspect_ratio: 1.78,
					vote_average: 5,
					image_type: "backdrop",
					media: { title: "Forrest Gump" },
				},
			],
		});

		expect(slides[0]?.key).toBe("tagged-1");
		expect(slides[0]?.label).toBe("Tom Hanks in Forrest Gump");
		expect(slides[0]?.src).toContain("/w1280/wide-tag.jpg");
		expect(slides[0]?.srcFull).toContain("/original/wide-tag.jpg");
		expect(slides[0]?.aspectRatio).toBe(1.78);
		expect(slides[1]?.label).toBe("Tom Hanks in Cast Away");
		expect(slides[1]?.aspectRatio).toBe(0.67);
	});

	test("fills with extra profiles excluding the hero portrait", () => {
		const slides = buildPersonGallerySlides({
			personName: "Actor",
			heroProfilePath: "/hero.jpg",
			profiles: [
				{ file_path: "/hero.jpg", vote_average: 10 },
				{ file_path: "/alt.jpg", vote_average: 8 },
			],
		});

		expect(slides).toHaveLength(1);
		expect(slides[0]?.key).toBe("profile-1");
		expect(slides[0]?.src).toContain("/h632/alt.jpg");
		expect(slides[0]?.label).toBe("Actor portrait 1");
		expect(slides[0]?.aspectRatio).toBeCloseTo(2 / 3);
	});

	test("dedupes file paths and respects maxSlides", () => {
		const slides = buildPersonGallerySlides({
			personName: "Actor",
			heroProfilePath: null,
			taggedImages: [
				{ file_path: "/a.jpg", aspect_ratio: 1.8, vote_average: 1 },
				{ file_path: "/a.jpg", aspect_ratio: 1.8, vote_average: 2 },
				{ file_path: "/b.jpg", aspect_ratio: 1.8, vote_average: 3 },
			],
			maxSlides: 1,
		});

		expect(slides).toHaveLength(1);
		expect(slides[0]?.src).toContain("/b.jpg");
	});

	test("returns empty when TMDb has no gallery media", () => {
		expect(
			buildPersonGallerySlides({
				personName: "Actor",
				heroProfilePath: "/hero.jpg",
				taggedImages: [],
				profiles: [{ file_path: "/hero.jpg" }],
			}),
		).toEqual([]);
	});
});
