// Fail when any commit in a range adds a forbidden path (forbidden.mjs), even if a later commit
// deletes it again: once pushed to this public repository, the file stays in history for good.
// tracked-files.test.ts sees only the current index; CI runs this over the pull request's commits.
//
// Usage: node tools/repo-guard/added-files.mjs [base] [head]   (head defaults to HEAD)
//
// Scans the commits in base..head. With no base, an all-zero base (GitHub's "before" on a new
// branch) or a base this clone doesn't have (a force push), it scans every commit behind head.
// Needs the full history: a shallow clone would hide the older commits.

import { execFileSync } from 'node:child_process';
import { forbiddenPaths } from './forbidden.mjs';

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`repo-guard: ${message}`);
  process.exit(1);
}

/** @param {string[]} args */
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

/** @param {string} rev */
function isCommit(rev) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

const [base = '', head = 'HEAD'] = process.argv.slice(2);

if (!isCommit(head)) fail(`${head} is not a commit in this clone.`);
if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
  fail('this clone is shallow, so older commits are missing. Check out with fetch-depth: 0.');
}

const noBase = !base || /^0+$/.test(base);
if (!noBase && !isCommit(base)) console.log(`repo-guard: no commit ${base} here.`);
const range = noBase || !isCommit(base) ? head : `${base}..${head}`;

// --no-renames: a file moved into a forbidden path counts as added, not renamed.
// -m: a merge commit's own changes count too. -z keeps unusual file names unquoted.
const logArgs = ['log', '--no-renames', '-m', '--diff-filter=A', '--format='];
const names = git([...logArgs, '--name-only', '-z', range]).split('\0');
const added = [...new Set(names)].filter(Boolean);
const found = forbiddenPaths(added);

if (found.length > 0) {
  for (const path of found) {
    const commits = new Set(
      git([...logArgs.slice(0, -1), '--format=%h', range, '--', path]).split('\n'),
    );
    console.error(`  ${path}  (added in ${[...commits].filter(Boolean).join(', ')})`);
  }
  fail(
    `${found.length} forbidden file(s) added in ${range}. Deleting them is not enough: ` +
      'rewrite these commits so the files never enter history, and rotate any secret first.',
  );
}

console.log(`repo-guard: ${added.length} added file(s) in ${range}, none forbidden.`);
