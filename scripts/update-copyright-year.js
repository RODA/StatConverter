#!/usr/bin/env node
/*
    Stamps the current year onto every copyright notice in the repository.

    Notices are written as a range that starts at the first year of the project
    and ends at the year of the build: "Copyright (c) 2021-2026, Adrian Dusa",
    "© 2021-2026 Adrian Dusa". This script rewrites the end of that range, so
    the About panel, the LICENSE and the source headers never fall behind.

        node scripts/update-copyright-year.js            update the files
        node scripts/update-copyright-year.js --check    report, change nothing
        node scripts/update-copyright-year.js --year 2027

    --check exits non-zero when something is stale, which is what the release
    build runs so a release cannot ship last year's copyright.

    Files come from `git ls-files`, so anything added to the repository later is
    covered without touching this script.
*/

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// "Copyright (c) 2021-2026" / "© 2021-2026" / "© 2021-2026", with or without a range.
const NOTICE = /((?:Copyright \(c\)|Copyright \(C\)|©)\s+)(\d{4})(\s*[-–]\s*(\d{4}))?/g;

const BINARY_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.icns', '.icv',
  '.zip', '.gz', '.tgz', '.tar', '.dmg', '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.mov', '.rds', '.rda'
]);

function parseArgs(argv) {
  const options = { check: false, year: new Date().getFullYear() };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--check') {
      options.check = true;
      continue;
    }

    const inline = /^--year=(\d{4})$/.exec(arg);
    if (inline) {
      options.year = Number(inline[1]);
      continue;
    }

    if (arg === '--year') {
      const value = argv[i + 1];
      if (!/^\d{4}$/.test(String(value))) {
        throw new Error('--year needs a four digit year, for example --year 2027');
      }
      options.year = Number(value);
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString('utf8');

  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => !BINARY_EXTENSIONS.has(path.extname(file).toLowerCase()));
}

// Returns the rewritten text, or null when the file already reads correctly.
function restamp(text, year) {
  let changed = false;

  const updated = text.replace(NOTICE, (match, prefix, start, range, end) => {
    const startYear = Number(start);

    // A notice that starts this year stays a single year; one that started
    // earlier becomes a range ending this year.
    const wanted = startYear >= year
      ? `${prefix}${start}`
      : `${prefix}${start}-${year}`;

    if (wanted !== match) {
      changed = true;
    }

    return wanted;
  });

  return changed ? updated : null;
}

function main() {
  const { check, year } = parseArgs(process.argv.slice(2));
  const stale = [];

  for (const file of trackedFiles()) {
    const full = path.join(root, file);

    let text;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue; // deleted, or not readable as text
    }

    if (text.includes('\0')) {
      continue; // binary file with a text-like extension
    }

    const updated = restamp(text, year);
    if (updated === null) {
      continue;
    }

    stale.push(file);

    if (!check) {
      fs.writeFileSync(full, updated);
    }
  }

  if (stale.length === 0) {
    console.log(`Copyright notices already end at ${year}.`);
    return;
  }

  if (check) {
    console.error(`Copyright notices are not up to date (${year}):`);
    stale.forEach((file) => console.error(`  ${file}`));
    console.error('\nRun: npm run update:year');
    process.exitCode = 1;
    return;
  }

  console.log(`Copyright notices updated to ${year}:`);
  stale.forEach((file) => console.log(`  ${file}`));
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
