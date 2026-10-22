# M7 principal campaign budget amendment

Use when the principal campaign is **intentionally smaller** than the protocol minimum (four cells × five pairs = **20** pairs). Required for M7 gate acceptance when `pair_count` &lt; 20.

Copy this section into a dated amendment (or edit this file) and reference the **`campaign_id`** below.

## Amendment record

| Field | Value |
| --- | --- |
| Campaign ID | _e.g. principal-local-smoke-001_ |
| Date (UTC) | |
| Author | |
| Planned pairs | _e.g. 1 via `--max-pairs 1` or `--smoke`_ |

## Reason

_Document budget, time, or local-only scope (e.g. smoke validation, single-cell pilot)._

## Scope reduction

| Protocol default | This run |
| --- | --- |
| 4 cells, 5 reps each | _cells / reps / max-pairs used_ |
| 180s k6 per scenario | _duration if different_ |
| Confirmatory results | _yes / no — smoke only_ |

## Acceptance impact

- Confirmatory claims require a **protocol-full** campaign or a written follow-up plan.
- Invalid runs remain archived; reduced scope does not relax correctness gates per pair.

## Approval

- [ ] Campaign owner
- [ ] Second reviewer (if applicable)
