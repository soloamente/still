/**
 * Shared runner contract for Settings and onboarding import panels.
 */

/** Parent-owned Import control — onboarding reads this instead of rendering inner buttons. */
export type ImportPanelRunner = {
	canImport: boolean;
	isImporting: boolean;
	runImport: () => Promise<boolean>;
};
