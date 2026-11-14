delete process.env.ELECTRON_RUN_AS_NODE;
process.argv.splice(1, 1, "electron-vite");
await import("../node_modules/electron-vite/dist/cli.js");
