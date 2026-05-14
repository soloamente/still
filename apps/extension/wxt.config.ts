import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // Disable the browser runner so WXT doesn't try to auto-launch Chrome
  // via CDP (which fails when Chrome isn't running). Load the extension
  // manually from chrome://extensions instead.
  runner: {
    disabled: true,
  },
});
