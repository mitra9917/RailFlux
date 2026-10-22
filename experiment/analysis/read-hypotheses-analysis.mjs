/**
 * Parse hypothesis definitions for analysis (M7 #66).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_HYPOTHESES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../hypotheses.yaml',
);

/**
 * @param {string} text
 */
export function parseHypothesesForAnalysis(text) {
  const paired = /^  paired:\s*true/m.test(text);
  const effect = text.match(/^  effect:\s*(\S+)/m)?.[1] ?? 'log_ratio_optimized_over_baseline';
  const interval =
    text.match(/^  interval:\s*(\S+)/m)?.[1] ?? 'paired_bootstrap_95_percent';
  const secondaryMultiplicity =
    text.match(/^  secondary_multiplicity:\s*(\S+)/m)?.[1] ?? 'holm';

  /** @type {object[]} */
  const hypotheses = [];
  const blocks = text.split(/\n  - id: /).slice(1);
  for (const block of blocks) {
    const id = block.match(/^(\S+)/)?.[1];
    if (!id) continue;
    const primary = /primary:\s*true/.test(block);
    const metric = block.match(/^\s*metric:\s*(\S+)/m)?.[1];
    const minimumEffect = block.match(/minimum_effect_ratio:\s*([\d.]+)/)?.[1];
    const maximumEffect = block.match(/maximum_effect_ratio:\s*([\d.]+)/)?.[1];
    const design = block.match(/design:\s*(\S+)/)?.[1];
    hypotheses.push({
      id,
      primary,
      metric: metric ?? null,
      minimum_effect_ratio: minimumEffect ? Number(minimumEffect) : null,
      maximum_effect_ratio: maximumEffect ? Number(maximumEffect) : null,
      design: design ?? null,
      secondary: !primary && !design,
    });
  }

  return {
    analysis: { paired, effect, interval, secondary_multiplicity: secondaryMultiplicity },
    hypotheses,
  };
}

/**
 * @param {string} [hypothesesPath]
 */
export function loadHypothesesForAnalysis(hypothesesPath) {
  const file = hypothesesPath || DEFAULT_HYPOTHESES;
  const text = fs.readFileSync(file, 'utf8');
  return parseHypothesesForAnalysis(text);
}
