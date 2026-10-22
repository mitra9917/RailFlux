/**
 * Selected failure tests at ~80% calibrated load (M7 #65).
 * One fault at a time; see experiment/test-catalog.md.
 */

/** @typedef {'baseline' | 'optimized'} Architecture */

/**
 * @typedef {object} FailureTestDef
 * @property {string} id FT-00x
 * @property {string} type manifest failure_injection.type
 * @property {Architecture[]} architectures
 * @property {string} summary
 */

export const DEFAULT_FAILURE_INJECTION_OFFSET_SECONDS = 60;

export const FAILURE_TESTS = [
  {
    id: 'FT-001',
    type: 'task_loss',
    architectures: ['baseline', 'optimized'],
    summary: 'Stop one application task; measure errors and replacement recovery.',
  },
  {
    id: 'FT-002',
    type: 'redis_unavailable',
    architectures: ['optimized'],
    summary: 'Redis unavailable; reads degrade, bookings unaffected.',
  },
  {
    id: 'FT-003',
    type: 'worker_paused',
    architectures: ['optimized'],
    summary: 'Pause worker; bookings commit, queue drains after recovery.',
  },
  {
    id: 'FT-005',
    type: 'db_latency_250ms',
    architectures: ['baseline', 'optimized'],
    summary: 'Application-controlled +250 ms query delay.',
  },
  {
    id: 'FT-007',
    type: 'payment_delay_5xx',
    architectures: ['baseline', 'optimized'],
    summary: 'Payment stub delay/5xx; rollback and errors are exact.',
  },
];

/**
 * @param {typeof FAILURE_TESTS} catalog
 * @param {string[]} [ids]
 */
export function selectFailureTests(catalog, ids) {
  if (!ids?.length) return catalog;
  const set = new Set(ids.map((id) => id.toUpperCase()));
  return catalog.filter((t) => set.has(t.id));
}

/**
 * @param {FailureTestDef} test
 * @param {Architecture} architecture
 */
export function cacheConditionForFailureRun(test, architecture) {
  if (architecture === 'optimized' && test.id === 'FT-002') return 'warm';
  return architecture === 'optimized' ? 'warm' : 'none';
}
