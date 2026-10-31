// Paths that must never enter this public repository, whatever .gitignore says: `git add -f`
// or a moved folder gets past an ignore rule. One list, used by the check on the current index
// (tracked-files.test.ts) and the check on every file a commit range adds (added-files.mjs).

export const FORBIDDEN = [
  // The private catalog snapshot, wherever it ends up, compressed or not (CONTRIBUTING.md).
  /^app\/public\/catalog\//,
  /(^|\/)catalog\.[0-9a-f]{8,}\.json(\.(br|gz))?$/i,
  // Secrets: every .env file except the committed list of names, plus *.env and .envrc.
  /(^|\/)\.env(?!\.example$)(\..*)?$/,
  /(^|\/)[^/]+\.env$/,
  /(^|\/)\.envrc$/,
];

/** @param {string[]} paths repository-relative paths @returns {string[]} */
export function forbiddenPaths(paths) {
  return paths.filter((path) => FORBIDDEN.some((pattern) => pattern.test(path)));
}
