// The bundled NSIS decoder cannot decode every automatic filter selected by
// modern 7-Zip. Keep maximum solid compression, but force its compatible BCJ
// filter so ARM helpers and native binaries are not silently skipped.
// https://github.com/electron-userland/electron-builder/issues/9983
module.exports = async function configureInstallerCompression(context) {
  if (context.electronPlatformName !== "win32") return;
  process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL = "9";
  process.env.ELECTRON_BUILDER_7Z_FILTER = "BCJ";
};
