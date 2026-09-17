const { test, expect } = require('@jest/globals');
const { rebasePaths } = require('../../scripts/normalize-android-paths');

test('Windows aliases keep in-repo native paths on one drive without changing external modules or metadata', () => {
  const input = { root: 'C:\\repo', library: { sourceDir: 'C:\\repo\\node_modules\\screens\\android',
    cmake: 'C:/repo/node_modules/screens/CMakeLists.txt', names: ['RNScreen', null] },
    outside: 'C:\\repo-other\\android', external: 'D:\\shared\\android', relative: '../shared' };
  expect(rebasePaths(input, 'C:\\repo', 'W:\\mobile')).toEqual({ root: 'W:\\mobile',
    library: { sourceDir: 'W:\\mobile\\node_modules\\screens\\android', cmake: 'W:/mobile/node_modules/screens/CMakeLists.txt', names: ['RNScreen', null] },
    outside: input.outside, external: input.external, relative: input.relative });
  expect(input.root).toBe('C:\\repo');
  expect(rebasePaths('c:/REPO/file', 'C:\\repo', 'W:\\mobile')).toBe('W:/mobile/file');
});
