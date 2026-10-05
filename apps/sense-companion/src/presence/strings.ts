import generalStrings from "../../vendor/premid-activities/websites/general.json";
import netflixStrings from "../../vendor/premid-activities/websites/N/Netflix/Netflix.json";

type StringEntry = {
	message: string;
};

const englishCatalog: Record<string, StringEntry> = {
	...generalStrings,
	...netflixStrings,
};

/** English only. Locale packs can wait until the popup has a language control. */
export function resolveEnglishStrings<T extends Record<string, string>>(
	request: T,
): Promise<{ [K in keyof T]: string }> {
	const resolved = {} as { [K in keyof T]: string };
	for (const key of Object.keys(request) as (keyof T)[]) {
		const catalogKey = request[key];
		resolved[key] = englishCatalog[catalogKey]?.message ?? catalogKey;
	}
	return Promise.resolve(resolved);
}
