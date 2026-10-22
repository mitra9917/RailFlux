/**
 * Read frozen calibration rates from experiment/hypotheses.yaml (M7 #64).
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
export function parseHypothesesCalibration(text) {
  const status = text.match(/^status:\s*(\S+)/m)?.[1] ?? '';
  const sloCapacity = Number(text.match(/^\s*slo_capacity_offered_rps:\s*([\d.]+)/m)?.[1] || 0);
  const pct50 = Number(text.match(/^\s*pct_50:\s*([\d.]+)/m)?.[1] || 0);
  const pct80 = Number(text.match(/^\s*pct_80:\s*([\d.]+)/m)?.[1] || 0);
  const pct110 = Number(text.match(/^\s*pct_110:\s*([\d.]+)/m)?.[1] || 0);
  return {
    status,
    frozen: status === 'frozen',
    slo_capacity_offered_rps: sloCapacity,
    progressive_load_rps: { pct_50: pct50, pct_80: pct80, pct_110: pct110 },
  };
}

/**
 * @param {string} [hypothesesPath]
 */
export function loadHypothesesCalibration(hypothesesPath) {
  const file = hypothesesPath || DEFAULT_HYPOTHESES;
  const text = fs.readFileSync(file, 'utf8');
  return parseHypothesesCalibration(text);
}

/**
 * @param {string} loadLevel e.g. L80
 * @param {{ progressive_load_rps?: { pct_50?: number, pct_80?: number, pct_110?: number } }} calibration
 * @param {number} [fallback]
 */
export function arrivalRateForLoadLevel(loadLevel, calibration, fallback = 8) {
  const level = String(loadLevel || 'L80').toUpperCase();
  const map = {
    L50: 'pct_50',
    L80: 'pct_80',
    L110: 'pct_110',
    FAILURE: 'pct_80',
  };
  const key = map[level];
  const rate = key ? calibration?.progressive_load_rps?.[key] : 0;
  if (typeof rate === 'number' && rate > 0) return rate;
  const match = /^L(\d+)$/i.exec(level);
  if (match) return Math.max(1, Math.min(50, Math.round(Number(match[1]) / 10)));
  return fallback;
}
