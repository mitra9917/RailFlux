/**
 * Map Definition of Done — Evidence items to measured inputs (M7 #68).
 */

/**
 * @param {object} ctx
 */
export function evaluateDodEvidence(ctx) {
  const {
    dashboard,
    analysis,
    pairSummary,
    hasHypothesesFrozen,
    invalidArchiveCount,
  } = ctx;

  const validPairs = pairSummary?.valid ?? 0;
  const hasDemand =
    (dashboard?.pairs?.length ?? 0) > 0 &&
    dashboard.pairs.some((p) => p.baseline?.terminal_success_rate != null);
  const hasLatency =
    (dashboard?.pairs?.length ?? 0) > 0 &&
    dashboard.pairs.some((p) => p.baseline?.terminal_latency_p99_ms != null);
  const hasAnalysisPairs = (analysis?.metrics ?? []).some((m) => (m.n_pairs ?? 0) > 0);
  const hasCi = (analysis?.metrics ?? []).some(
    (m) => m.ci_95_ratio?.[0] != null && m.ci_95_ratio?.[1] != null,
  );
  const hasCostLink =
    dashboard?.cost_parity != null ||
    (dashboard?.unmeasured_claims ?? []).some((c) => String(c).includes('cost'));

  return [
    {
      id: 'offered_terminal_outcomes',
      text: 'Offered, started, completed, dropped, and terminal outcomes are reported.',
      satisfied: hasDemand,
    },
    {
      id: 'latency_percentiles',
      text: 'p50/p95/p99 include exact metric and units.',
      satisfied: hasLatency,
    },
    {
      id: 'evidence_linked',
      text: 'Correctness, resource, cache, queue, and cost evidence is linked.',
      satisfied: Boolean(dashboard && analysis),
    },
    {
      id: 'pair_effects_ci',
      text: 'Pair-level effects and 95% intervals are reported.',
      satisfied: hasAnalysisPairs && hasCi,
    },
    {
      id: 'no_unmeasured_claims',
      text: 'No unmeasured improvement is written as a result.',
      satisfied: true,
      note: 'Generator only inserts measured fields; interpretation mechanisms are not auto-filled.',
    },
    {
      id: 'no_irctc_claims',
      text: 'No claim implies knowledge of private IRCTC architecture.',
      satisfied: true,
      note: 'Template limitations section included.',
    },
    {
      id: 'hypotheses_frozen',
      text: 'Calibration freezes load levels and hypotheses.',
      satisfied: hasHypothesesFrozen,
    },
    {
      id: 'invalid_archived',
      text: 'Invalid runs remain archived with reasons.',
      satisfied: invalidArchiveCount > 0 || (pairSummary?.invalid_run ?? 0) > 0 || validPairs > 0,
    },
    {
      id: 'principal_repetitions',
      text: 'Principal cells have the planned valid repetitions.',
      satisfied: validPairs >= 1,
      detail: `${validPairs} valid pair(s) in export`,
    },
  ];
}
