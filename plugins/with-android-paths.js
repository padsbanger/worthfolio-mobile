const { withSettingsGradle } = require('expo/config-plugins');

module.exports = function withAndroidPaths(config) {
  return withSettingsGradle(config, mod => {
    const original = 'ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)';
    const marker = '../scripts/normalize-android-paths.js';
    if (!mod.modResults.contents.includes(marker)) {
      if (!mod.modResults.contents.includes(original)) throw new Error('Expo autolinking template changed; review the Windows path adapter.');
      mod.modResults.contents = mod.modResults.contents.replace(original,
        `ex.autolinkLibrariesFromCommand(["node", new File(rootDir, "${marker}").absolutePath, rootDir.parentFile.absolutePath] + expoAutolinking.rnConfigCommand)`);
    }
    return mod;
  });
};
