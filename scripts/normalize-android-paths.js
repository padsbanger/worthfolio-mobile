const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Expo resolves junctions/SUBST to C:, while Gradle retains W:. Keep paths
// inside this checkout on Gradle's drive; never rewrite external dependencies.
function rebasePaths(value, realRoot, projectRoot) {
  if (typeof value === 'string' && path.win32.isAbsolute(value)) {
    const relative = path.win32.relative(realRoot, value);
    if (relative !== '..' && !relative.startsWith('..\\') && !path.win32.isAbsolute(relative)) {
      const rebased = path.win32.join(projectRoot, relative);
      return value.includes('/') ? rebased.replace(/\\/g, '/') : rebased;
    }
  } else if (Array.isArray(value)) {
    return value.map(item => rebasePaths(item, realRoot, projectRoot));
  } else if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebasePaths(item, realRoot, projectRoot)]));
  }
  return value;
}

if (require.main === module) {
  const [projectRoot, command, ...args] = process.argv.slice(2);
  if (!projectRoot || !command) throw new Error('Expected project root and Expo autolinking command.');
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || 'Expo autolinking failed.');
    process.exit(result.status || 1);
  }
  const config = JSON.parse(result.stdout);
  process.stdout.write(JSON.stringify(process.platform === 'win32'
    ? rebasePaths(config, fs.realpathSync.native(projectRoot), projectRoot) : config));
}

module.exports = { rebasePaths };
