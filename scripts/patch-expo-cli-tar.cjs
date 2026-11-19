/**
 * Temporary Expo SDK 51 / tar 7 interoperability fix.
 *
 * @expo/cli 0.18.31 imports tar as a default export, but safe tar 7 reports
 * __esModule without exporting `default`. Patch only the two known extraction
 * callsites after npm ci. Delete this hook when upgrading Expo to a release
 * with a compatible tar import.
 */
const fs = require('node:fs');
const path = require('node:path');

const cliRoot = path.dirname(require.resolve('@expo/cli/package.json'));
const cliVersion = require(path.join(cliRoot, 'package.json')).version;
if (cliVersion !== '0.18.31') {
  throw new Error(`Review Expo tar interop for @expo/cli ${cliVersion} before changing the pinned version`);
}

const tar = require('tar');
if (typeof tar.extract !== 'function') {
  throw new Error('The installed tar dependency does not expose extract()');
}

const before = '_tar().default.extract(';
const after = '(_tar().default || _tar()).extract(';
for (const relative of ['build/src/utils/npm.js', 'build/src/utils/tar.js']) {
  const file = path.join(cliRoot, relative);
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(after) && !source.includes(before)) continue;
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Unexpected Expo CLI tar extraction shape in ${relative} (${occurrences} matches)`);
  }
  fs.writeFileSync(file, source.replace(before, after));
  console.log(`Applied Expo tar compatibility correction: ${relative}`);
}
