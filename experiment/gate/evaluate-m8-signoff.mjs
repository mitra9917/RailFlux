/**
 * M8 #75 — gate sign-off checklist (simulator E2E + DoD frontend items).
 */
import fs from 'node:fs';

/** Keys must appear as `- [x] key` in the sign-off markdown. */
export const M8_SIGNOFF_KEYS = [
  'gate_automation_passed',
  'simulator_flow_local',
  'advisory_labels_reviewed',
  'synthetic_data_only',
];

/**
 * @param {string} markdown
 */
export function evaluateM8Signoff(markdown) {
  const missing = [];
  for (const key of M8_SIGNOFF_KEYS) {
    const checked = new RegExp(`-\\s*\\[x\\]\\s*${key}\\b`, 'i').test(markdown);
    if (!checked) missing.push(key);
  }
  return {
    satisfied: missing.length === 0,
    missing,
    keys: M8_SIGNOFF_KEYS,
  };
}

/**
 * @param {string} signoffPath
 */
export function evaluateM8SignoffFile(signoffPath) {
  if (!signoffPath || !fs.existsSync(signoffPath)) {
    return { satisfied: false, missing: M8_SIGNOFF_KEYS, keys: M8_SIGNOFF_KEYS, path: signoffPath };
  }
  const markdown = fs.readFileSync(signoffPath, 'utf8');
  return { ...evaluateM8Signoff(markdown), path: signoffPath };
}
