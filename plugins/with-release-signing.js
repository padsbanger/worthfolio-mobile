const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

// Keep generated android/ reproducible without embedding signing credentials.
module.exports = function withReleaseSigning(config) {
  config = withGradleProperties(config, mod => {
    // Release lint loads more classes than debug; the template's 512 MB fails.
    const settings = { 'org.gradle.jvmargs': '-Xmx2048m -XX:MaxMetaspaceSize=1024m', 'org.gradle.workers.max': '2' };
    for (const [key, value] of Object.entries(settings)) {
      const property = mod.modResults.find(item => item.type === 'property' && item.key === key);
      if (property) property.value = value;
      else mod.modResults.push({ type: 'property', key, value });
    }
    return mod;
  });
  return withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Expected the Expo Groovy Android template.');
    const statement = "apply from: new File(rootProject.projectDir, '../plugins/android-release-signing.gradle')";
    if (!mod.modResults.contents.includes(statement)) mod.modResults.contents += `\n${statement}\n`;
    return mod;
  });
};
