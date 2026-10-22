/**
 * M7 #70 — gate sign-off checklist (report + DoD evidence reviewed).
 */
import fs from 'node:fs';

/** Keys must appear as `- [x] key` in the sign-off markdown. */
export const M7_SIGNOFF_KEYS = [
  'campaign_scope_accepted',
  'report_generated',
  'dod_evidence_reviewed',
  'reproducibility_walkthrough_recorded',
];

/**
 * @param {string} markdown
 */
export function evaluateM7Signoff(markdown) {
  const missing = [];
  for (const key of M7_SIGNOFF_KEYS) {
    const checked = new RegExp(`-\\s*\\[x\\]\\s*${key}\\b`, 'i').test(markdown);
    if (!checked) missing.push(key);
  }
  return {
    satisfied: missing.length === 0,
    missing,
    keys: M7_SIGNOFF_KEYS,
  };
}

/**
 * @param {string} signoffPath
 */
export function evaluateM7SignoffFile(signoffPath) {
  if (!signoffPath || !fs.existsSync(signoffPath)) {
    return { satisfied: false, missing: M7_SIGNOFF_KEYS, keys: M7_SIGNOFF_KEYS, path: signoffPath };
  }
  const markdown = fs.readFileSync(signoffPath, 'utf8');
  return { ...evaluateM7Signoff(markdown), path: signoffPath };
}
