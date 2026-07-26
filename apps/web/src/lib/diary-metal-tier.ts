export type DiaryMetalTier = "silver" | "gold" | "chromatic";

/** Plan avatar auras only apply to circular patron portraits. */
export function isCircularPatronPortraitClass(className?: string): boolean {
	if (!className) return true;
	if (/rounded-2xl|rounded-xl|rounded-lg|rounded-md/.test(className)) {
		return false;
	}
	return /rounded-full/.test(className) || !/rounded-/.test(className);
}
