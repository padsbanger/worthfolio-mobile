/* global __dirname */
const { withAndroidManifest, withMainApplication, withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function withWidget(config) {
  config = withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] ??= [];
    if (!manifest['uses-permission'].some(p => p.$['android:name'] === 'android.permission.RECEIVE_BOOT_COMPLETED')) {
      manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.RECEIVE_BOOT_COMPLETED' } });
    }
    const app = manifest.application[0];
    app.receiver ??= [];
    app.receiver = app.receiver.filter(r => r.$['android:name'] !== '.widget.PortfolioWidget');
    app.receiver.push({ $: { 'android:name': '.widget.PortfolioWidget', 'android:exported': 'false', 'android:label': '@string/widget_name' },
      'intent-filter': [{ action: [
        { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
        { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
        { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
      ] }],
      'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/portfolio_widget' } }],
    });
    return mod;
  });
  config = withMainApplication(config, mod => {
    const marker = 'add(com.worthfolio.mobile.widget.WidgetPackage())';
    if (!mod.modResults.contents.includes(marker)) {
      const anchor = 'PackageList(this).packages.apply {';
      if (!mod.modResults.contents.includes(anchor)) throw new Error('Review widget registration: MainApplication template changed.');
      mod.modResults.contents = mod.modResults.contents.replace(anchor, `${anchor}\n          ${marker}`);
    }
    return mod;
  });
  config = withAppBuildGradle(config, mod => {
    const marker = '// Worthfolio widget instrumentation';
    if (!mod.modResults.contents.includes(marker)) mod.modResults.contents += `\n${marker}\nandroid {\n    testBuildType "release"\n    defaultConfig { testInstrumentationRunner "com.worthfolio.mobile.widget.WidgetInstrumentation" }\n}\n`;
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const main = path.join(mod.modRequest.platformProjectRoot, 'app/src/main');
    fs.mkdirSync(path.join(main, 'java/com/worthfolio/mobile/widget'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'widget/PortfolioWidget.kt'), path.join(main, 'java/com/worthfolio/mobile/widget/PortfolioWidget.kt'));
    fs.cpSync(path.join(__dirname, 'widget/res'), path.join(main, 'res'), { recursive: true });
    const tests = path.join(mod.modRequest.platformProjectRoot, 'app/src/androidTest/java/com/worthfolio/mobile/widget');
    fs.mkdirSync(tests, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'widget/WidgetInstrumentation.kt'), path.join(tests, 'WidgetInstrumentation.kt'));
    return mod;
  }]);
};
