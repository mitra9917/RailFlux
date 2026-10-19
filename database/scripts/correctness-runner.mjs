/**
 * Parse and evaluate experiment/correctness.sql invariant checks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, readManifest } from './fixture-checksum.mjs';

export const DEFAULT_CORRECTNESS_SQL = path.join(REPO_ROOT, 'experiment/correctness.sql');

function sqlStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** @typedef {{ id: string, description: string, sql: string }} CorrectnessCheck */

/**
 * @param {string} text
 * @returns {CorrectnessCheck[]}
 */
export function parseCorrectnessChecks(text) {
  /** @type {CorrectnessCheck[]} */
  const checks = [];
  /** @type {{ description: string, lines: string[] } | null} */
  let current = null;

  for (const line of text.split('\n')) {
    if (line.startsWith('-- ')) {
      const comment = line.slice(3).trim();
      if (comment.startsWith('RailFlux post-run') || comment.startsWith('Replace :run_id')) {
        continue;
      }
      if (current && current.lines.join('\n').trim()) {
        checks.push(finalizeCheck(current, checks.length));
      }
      current = { description: comment, lines: [] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    }
  }
  if (current && current.lines.join('\n').trim()) {
    checks.push(finalizeCheck(current, checks.length));
  }
  return checks;
}

/**
 * @param {{ description: string, lines: string[] }} block
 * @param {number} index
 * @returns {CorrectnessCheck}
 */
function finalizeCheck(block, index) {
  const slug = block.description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
  return {
    id: slug || `check_${index + 1}`,
    description: block.description,
    sql: block.lines.join('\n').trim(),
  };
}

/**
 * @param {string} sql
 * @param {{ runId: string, fixtureId: string }} bindings
 */
export function bindCorrectnessSql(sql, bindings) {
  return sql
    .replaceAll(':run_id', sqlStringLiteral(bindings.runId))
    .replaceAll(':fixture_id', sqlStringLiteral(bindings.fixtureId));
}

/**
 * @param {Record<string, unknown>[]} rows
 */
export function isCorrectnessViolation(rows) {
  if (!rows || rows.length === 0) {
    return false;
  }
  if (rows.length === 1) {
    const values = Object.values(rows[0]);
    if (values.length === 1) {
      const n = Number(values[0]);
      if (!Number.isNaN(n)) {
        return n > 0;
      }
    }
  }
  return true;
}

/**
 * @param {import('mysql2/promise').Connection | import('mysql2/promise').Pool} db
 * @param {{ runId: string, fixtureId: string, sqlPath?: string }} options
 */
export async function runCorrectnessChecks(db, options) {
  const sqlPath = options.sqlPath ?? DEFAULT_CORRECTNESS_SQL;
  const text = fs.readFileSync(sqlPath, 'utf8');
  const checks = parseCorrectnessChecks(text);
  /** @type {{ id: string, description: string, rows: Record<string, unknown>[] }[]} */
  const failures = [];

  for (const check of checks) {
    const bound = bindCorrectnessSql(check.sql, {
      runId: options.runId,
      fixtureId: options.fixtureId,
    });
    const [rows] = await db.query(bound);
    const rowList = /** @type {Record<string, unknown>[]} */ (rows);
    if (isCorrectnessViolation(rowList)) {
      failures.push({ id: check.id, description: check.description, rows: rowList });
    }
  }

  return {
    passed: failures.length === 0,
    runId: options.runId,
    fixtureId: options.fixtureId,
    checkCount: checks.length,
    failures,
  };
}

export function resolveFixtureId(manifestPath) {
  return readManifest(manifestPath).fixtureId;
}
