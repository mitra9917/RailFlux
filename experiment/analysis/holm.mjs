/**
 * Holm step-down correction for secondary hypothesis families (M7 #66 / protocol).
 */

/**
 * @param {{ id: string, p_value: number | null }[]} tests sorted by ascending p_value recommended
 * @param {number} [alpha]
 */
export function holmAdjust(tests, alpha = 0.05) {
  const sorted = [...tests]
    .filter((t) => typeof t.p_value === 'number' && Number.isFinite(t.p_value))
    .sort((a, b) => a.p_value - b.p_value);
  const m = sorted.length;
  /** @type {typeof sorted} */
  const out = [];
  for (let i = 0; i < m; i += 1) {
    const threshold = alpha / (m - i);
    const reject = sorted[i].p_value <= threshold;
    out.push({
      ...sorted[i],
      holm_rank: i + 1,
      holm_threshold: threshold,
      holm_reject: reject,
    });
  }
  return out;
}
