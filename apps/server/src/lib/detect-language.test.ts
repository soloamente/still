import { describe, expect, test } from "bun:test";

import {
	detectReviewLanguage,
	stripUndetectableNoise,
} from "./detect-language";

describe("stripUndetectableNoise", () => {
	test("drops listing and person mention tokens whole", () => {
		const stripped = stripUndetectableNoise(
			"Loved #[Dune: Part Two](/movies/438631) — @[Denis Villeneuve](/people/1032) again.",
		);
		expect(stripped).not.toContain("438631");
		expect(stripped).not.toContain("Villeneuve");
		expect(stripped).toContain("Loved");
	});

	test("drops bare urls", () => {
		expect(stripUndetectableNoise("see https://example.com/x now")).toBe(
			"see now",
		);
	});
});

describe("detectReviewLanguage", () => {
	const prose: Record<string, string> = {
		en: "A gorgeous, aching film. He shoots the desert like a cathedral and I did not breathe for the last twenty minutes.",
		es: "Una pelicula preciosa y desgarradora. La fotografia del desierto es una maravilla y el final me dejo sin aliento.",
		fr: "Un film magnifique et bouleversant. La photographie du desert est une merveille et la fin m'a coupe le souffle.",
		pt: "Um filme lindo e comovente. A fotografia do deserto e maravilhosa e o final me deixou sem folego.",
		de: "Ein wunderschoner und ergreifender Film. Die Bilder der Wuste sind grossartig und das Ende hat mich sprachlos gemacht.",
		ja: "映画館で観てよかった。砂漠の映像がとても美しくて、音楽も素晴らしかったです。もう一度観たいと思います。",
		ko: "극장에서 보길 정말 잘했다. 사막 촬영이 너무 아름다웠고 음악도 훌륭했다. 다시 보고 싶다.",
	};

	for (const [expected, body] of Object.entries(prose)) {
		test(`detects ${expected} from review prose`, () => {
			expect(detectReviewLanguage(body)).toBe(expected);
		});
	}

	test("returns null rather than guessing on very short text", () => {
		// tinyld confidently calls "great" Irish — the length gate is what stops it.
		expect(detectReviewLanguage("great")).toBeNull();
		expect(detectReviewLanguage("Loved it")).toBeNull();
	});

	test("returns null for ratings, emoji and whitespace", () => {
		expect(detectReviewLanguage("10/10")).toBeNull();
		expect(detectReviewLanguage("🔥🔥🔥")).toBeNull();
		expect(detectReviewLanguage("   ")).toBeNull();
		expect(detectReviewLanguage("")).toBeNull();
	});

	test("returns null when the body is only mention tokens", () => {
		expect(
			detectReviewLanguage(
				"#[Dune: Part Two](/movies/438631) @[Denis Villeneuve](/people/1032)",
			),
		).toBeNull();
	});

	test("ignores mention tokens when judging the surrounding prose", () => {
		const body =
			"#[Dune: Part Two](/movies/438631) を映画館で観てよかった。砂漠の映像がとても美しくて、音楽も素晴らしかった。";
		expect(detectReviewLanguage(body)).toBe("ja");
	});

	test("detects short CJK prose that would fail the latin length gate", () => {
		// 12 characters, but unambiguous — a latin-length gate would drop it.
		expect(detectReviewLanguage("映画館で観てよかった。")).toBe("ja");
	});

	test("covers the non-latin scripts patrons actually write in", () => {
		expect(
			detectReviewLanguage(
				"在电影院看真是太好了，沙漠的画面非常美，音乐也很棒，我想再看一次。",
			),
		).toBe("zh");
		expect(
			detectReviewLanguage(
				"Прекрасный и мучительный фильм. Пустыня снята как собор, я не дышал последние двадцать минут.",
			),
		).toBe("ru");
		expect(
			detectReviewLanguage(
				"فيلم رائع ومؤلم. تم تصوير الصحراء مثل الكاتدرائية ولم أتنفس في العشرين دقيقة الأخيرة.",
			),
		).toBe("ar");
		expect(
			detectReviewLanguage(
				"बहुत ही खूबसूरत और भावुक फिल्म। रेगिस्तान की सिनेमैटोग्राफी लाजवाब थी।",
			),
		).toBe("hi");
	});

	// Regression cases taken from real rows in the production review table, where
	// tinyld's full model returned Berber/Romanian with high confidence.
	describe("real-corpus regressions", () => {
		test("elongated english stays english", () => {
			expect(
				detectReviewLanguage(
					"I cried sooo baaaad TuT I love it... it's very beautiful and very meaningful!",
				),
			).toBe("en");
			expect(
				detectReviewLanguage(
					"that post credit scene with wong was my favorite SUCH A LOVELYYYY FACEEEEEEE",
				),
			).toBe("en");
		});

		test("casual english stays english", () => {
			expect(
				detectReviewLanguage(
					"My friends got traumatized by Anora so I suggested this as a palette cleanser lmao.",
				),
			).toBe("en");
		});

		test("abbreviated italian stays italian", () => {
			expect(
				detectReviewLanguage(
					"la data esatta di quando vidi questo film nn ce l'ho ma cmq ho provato a stimare!!!",
				),
			).toBe("it");
		});
	});
});
