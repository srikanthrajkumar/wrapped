// The transliteration fold (docs/skills-router.md §5, "carnatic-search"). Applied to the search
// index and the query alike, so "Thodi", "Todi" and "Tōḍi" meet, as do "Poorvikalyani" and
// "Purvikalyani". Also gives own Artists and Sabhas their `nameKey`.

// Applied in order, after accents are stripped and before doubled letters collapse.
const RULES: [RegExp, string][] = [
  [/ee|ii/g, 'i'],
  [/oo|uu/g, 'u'],
  [/th/g, 't'],
  [/dh/g, 'd'],
  [/bh/g, 'b'],
  [/kh/g, 'k'],
  [/gh/g, 'g'],
  [/sh/g, 's'],
  [/zh/g, 'l'],
  [/w/g, 'v'],
];

export function fold(text: string): string {
  let folded = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  for (const [pattern, replacement] of RULES) folded = folded.replace(pattern, replacement);
  // Collapsing doubled letters also covers aa → a.
  return folded.replace(/([a-z])\1+/g, '$1');
}
