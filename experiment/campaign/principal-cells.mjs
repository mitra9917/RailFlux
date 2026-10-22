/**
 * Principal experiment cells (M7 #64) — protocol minimum viable campaign.
 */

/** @typedef {import('../controller/generate-run-manifest.mjs').buildRunManifest extends (...args: infer A) => unknown ? A[0] : never} ManifestInput */

export const DEFAULT_REPETITIONS = 5;

/**
 * Four primary cells: L80/L110 × legitimate-only / mixed cohort; contention inventory.
 * Baseline runs without app cache; optimized uses warm cache (per architecture).
 */
export const PRINCIPAL_CELLS = [
  {
    id: 'C1-L80-legit',
    loadLevel: 'L80',
    wafMode: 'off',
    inventoryProfile: 'contention',
    cohortMix: { legitimate: 1, bot_like: 0 },
    cacheConditionByArchitecture: { baseline: 'none', optimized: 'warm' },
  },
  {
    id: 'C2-L110-legit',
    loadLevel: 'L110',
    wafMode: 'off',
    inventoryProfile: 'contention',
    cohortMix: { legitimate: 1, bot_like: 0 },
    cacheConditionByArchitecture: { baseline: 'none', optimized: 'warm' },
  },
  {
    id: 'C3-L80-mixed',
    loadLevel: 'L80',
    wafMode: 'on',
    inventoryProfile: 'contention',
    cohortMix: { legitimate: 0.8, bot_like: 0.2 },
    cacheConditionByArchitecture: { baseline: 'none', optimized: 'warm' },
  },
  {
    id: 'C4-L110-mixed',
    loadLevel: 'L110',
    wafMode: 'on',
    inventoryProfile: 'contention',
    cohortMix: { legitimate: 0.8, bot_like: 0.2 },
    cacheConditionByArchitecture: { baseline: 'none', optimized: 'warm' },
  },
];

/**
 * @param {typeof PRINCIPAL_CELLS} cells
 * @param {string[]} [ids]
 */
export function selectPrincipalCells(cells, ids) {
  if (!ids?.length) return cells;
  const set = new Set(ids);
  return cells.filter((c) => set.has(c.id));
}
