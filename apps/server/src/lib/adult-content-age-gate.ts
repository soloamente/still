/** Validates patron DOB for profile save and adult-content gate (≥18). */
export function patronMeetsAdultAgeGate(
	birthDateIso: string,
	now = new Date(),
): boolean {
	const dob = new Date(`${birthDateIso}T12:00:00`);
	if (Number.isNaN(dob.getTime())) return false;
	const cutoff = new Date(now);
	cutoff.setFullYear(cutoff.getFullYear() - 18);
	cutoff.setHours(12, 0, 0, 0);
	return dob <= cutoff;
}
