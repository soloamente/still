import config from "./wxt.config";

/** Side build when dev server locks `.output/chrome-mv3`. */
export default {
	...config,
	outDir: ".output/popup-revert",
};
