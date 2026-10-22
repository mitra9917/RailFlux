/**
 * M7 #70 — principal campaign scope vs protocol full campaign or budget amendment.
 */
import fs from 'node:fs';
import { DEFAULT_REPETITIONS, PRINCIPAL_CELLS } from '../campaign/principal-cells.mjs';
import { summarizeValidPairs } from '../repro/verify-valid-pair.mjs';

/** Protocol minimum: four cells × five repetitions. */
export const FULL_PRINCIPAL_PAIR_COUNT = PRINCIPAL_CELLS.length * DEFAULT_REPETITIONS;

/**
 * @param {object} campaign
 */
export function validPairsPerCell(campaign) {
  /** @type {Map<string, object[]>} */
  const byPair = new Map();
  for (const o of campaign.outcomes ?? []) {
    const pairId = o.pair_id;
    if (!pairId) continue;
    if (!byPair.has(pairId)) byPair.set(pairId, []);
    byPair.get(pairId).push(o);
  }

  /** @type {Map<string, number>} */
  const byCell = new Map();
  for (const legs of byPair.values()) {
    if (legs.length < 2 || !legs.every((leg) => leg.valid)) continue;
    const cellId = legs[0].cell_id ?? 'unknown';
    byCell.set(cellId, (byCell.get(cellId) ?? 0) + 1);
  }
  return byCell;
}

/**
 * @param {object} campaign
 */
export function evaluatePrincipalCampaignScope(campaign) {
  const plan = campaign?.plan ?? {};
  return {
    campaign_id: plan.campaign_id ?? null,
    planned_pairs: plan.pair_count ?? plan.pairs?.length ?? 0,
    repetitions_per_cell: plan.repetitions_per_cell ?? null,
    cell_ids: plan.cells ?? [],
    protocol_full_pair_count: FULL_PRINCIPAL_PAIR_COUNT,
    is_protocol_full_plan: (plan.pair_count ?? plan.pairs?.length ?? 0) >= FULL_PRINCIPAL_PAIR_COUNT,
  };
}

/**
 * @param {string | null | undefined} amendmentPath
 * @param {string} campaignId
 */
export function budgetAmendmentDocumentsCampaign(amendmentPath, campaignId) {
  if (!amendmentPath || !fs.existsSync(amendmentPath)) return false;
  const text = fs.readFileSync(amendmentPath, 'utf8');
  if (!campaignId) return false;
  return text.includes(campaignId) && /budget|max-pairs|reduction|amendment/i.test(text);
}

/**
 * @param {object} campaign
 * @param {{ budgetAmendmentPath?: string | null, requireSignoff?: boolean }} [options]
 */
export function evaluateM7CampaignAcceptance(campaign, options = {}) {
  const scope = evaluatePrincipalCampaignScope(campaign);
  const pairSummary = summarizeValidPairs(campaign);
  const byCell = validPairsPerCell(campaign);
  const reps = scope.repetitions_per_cell ?? DEFAULT_REPETITIONS;
  const campaignId = scope.campaign_id ?? '';

  const runsTotal = campaign.runs_total ?? campaign.outcomes?.length ?? 0;
  const plannedRuns = scope.planned_pairs * 2;
  const executionComplete = runsTotal >= plannedRuns && Boolean(campaign.completed_at);

  const perCellTargets = scope.cell_ids.map((cellId) => ({
    cell_id: cellId,
    valid_pairs: byCell.get(cellId) ?? 0,
    target: reps,
    satisfied: (byCell.get(cellId) ?? 0) >= reps,
  }));

  const fullPlanMet =
    scope.is_protocol_full_plan &&
    executionComplete &&
    perCellTargets.length > 0 &&
    perCellTargets.every((c) => c.satisfied);

  const budgetReduced =
    scope.planned_pairs > 0 && scope.planned_pairs < FULL_PRINCIPAL_PAIR_COUNT;
  const amendmentOk = budgetAmendmentDocumentsCampaign(
    options.budgetAmendmentPath ?? null,
    campaignId,
  );
  const reducedPlanMet =
    budgetReduced &&
    amendmentOk &&
    executionComplete &&
    pairSummary.valid_pairs >= 1 &&
    pairSummary.valid_pairs >= scope.planned_pairs;

  const satisfied = fullPlanMet || reducedPlanMet;

  return {
    satisfied,
    mode: fullPlanMet ? 'protocol_full' : reducedPlanMet ? 'budget_reduced' : 'incomplete',
    scope,
    pair_summary: pairSummary,
    per_cell: perCellTargets,
    execution_complete: executionComplete,
    budget_amendment_required: budgetReduced,
    budget_amendment_ok: amendmentOk,
  };
}
