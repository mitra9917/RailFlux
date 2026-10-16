#!/usr/bin/env node
/**
 * Deterministic fixture SQL from experiment/fixtures/manifest.yaml (data seed).
 * Pipe to mysql: node generate-seed-sql.mjs | mysql ...
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function parseManifest(rawText) {
  const text = rawText.replace(/\r\n/g, '\n');
  const pick = (key) => {
    const m = text.match(new RegExp(`^${key}:\\s*"?([^"\\n#]+)"?`, 'm'));
    if (!m) throw new Error(`manifest missing ${key}`);
    return m[1].trim();
  };
  const pickInt = (key) => parseInt(pick(key), 10);
  const pickUnder = (parent, key) => {
    const block = text.match(
      new RegExp(`^${parent}:\\s*\\n((?:[ \\t].*\\n?)*)`, 'm'),
    )?.[1];
    if (!block) throw new Error(`manifest missing block ${parent}`);
    const m = block.match(new RegExp(`^\\s+${key}:\\s*(\\d+)`, 'm'));
    if (!m) throw new Error(`manifest missing ${parent}.${key}`);
    return parseInt(m[1], 10);
  };
  const pickUnderString = (parent, key) => {
    const block = text.match(
      new RegExp(`^${parent}:\\s*\\n((?:[ \\t].*\\n?)*)`, 'm'),
    )?.[1];
    if (!block) throw new Error(`manifest missing block ${parent}`);
    const m = block.match(new RegExp(`^\\s+${key}:\\s*"?([^"\\n#]+)"?`, 'm'));
    if (!m) throw new Error(`manifest missing ${parent}.${key}`);
    return m[1].trim();
  };
  const pickInBlock = (block, key) => {
    const m = block.match(new RegExp(`${key}:\\s*(\\d+)`));
    if (!m) throw new Error(`manifest missing ${key} in profile block`);
    return parseInt(m[1], 10);
  };
  const classesMatch = text.match(/classes:\s*\[(.*?)\]/);
  const classes = classesMatch
    ? classesMatch[1].split(',').map((s) => s.trim().replace(/"/g, ''))
    : ['SL', '3A', '2A'];
  const contentionBlock =
    text.match(/contention:\s*\n([\s\S]*?)(?=^\s*non_contention:|^\w|\z)/m)?.[1] ?? text;
  return {
    fixtureId: pick('fixture_id'),
    dataSeed: pickUnder('seeds', 'data'),
    users: pickUnder('entities', 'users'),
    stations: pickUnder('entities', 'stations'),
    trains: pickUnder('entities', 'trains'),
    trainRuns: pickUnder('entities', 'train_runs'),
    classes,
    quota: pickUnderString('entities', 'quota'),
    hotTrainRuns: pickInBlock(contentionBlock, 'hot_train_runs'),
    seatsPerHotBucket: pickInBlock(contentionBlock, 'seats_per_hot_bucket'),
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuidFromRng(rng) {
  const bytes = Uint8Array.from({ length: 16 }, () => Math.floor(rng() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sqlString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function stationCode(index) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const i = index % 26;
  const j = Math.floor(index / 26) % 26;
  return `S${a[i]}${a[j]}`.slice(0, 5);
}

const COHORTS = [
  'browser',
  'quick_booker',
  'retrying',
  'abandoning',
  'bot_like',
  'duplicate_submitter',
];

function main() {
  const manifestPath = process.env.FIXTURE_MANIFEST
    ? path.resolve(process.env.FIXTURE_MANIFEST)
    : path.join(repoRoot, 'experiment/fixtures/manifest.yaml');
  const manifest = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  const rng = mulberry32(manifest.dataSeed);
  const lines = [];

  lines.push('SET NAMES utf8mb4;');
  lines.push('SET FOREIGN_KEY_CHECKS=0;');
  lines.push(`DELETE FROM seat_inventory WHERE fixture_id = ${sqlString(manifest.fixtureId)};`);
  lines.push('DELETE FROM train_runs;');
  lines.push('DELETE FROM trains;');
  lines.push('DELETE FROM users;');
  lines.push('SET FOREIGN_KEY_CHECKS=1;');

  const stations = Array.from({ length: manifest.stations }, (_, i) => stationCode(i));

  for (let i = 0; i < manifest.users; i += 1) {
    const id = uuidFromRng(rng);
    const cohort = COHORTS[i % COHORTS.length];
    lines.push(
      `INSERT INTO users (id, cohort) VALUES (${sqlString(id)}, ${sqlString(cohort)});`,
    );
  }

  for (let t = 0; t < manifest.trains; t += 1) {
    const trainNo = String(10001 + t).padStart(5, '0');
    const source = stations[Math.floor(rng() * stations.length)];
    let dest = stations[Math.floor(rng() * stations.length)];
    if (dest === source) dest = stations[(stations.indexOf(source) + 1) % stations.length];
    const name = `RailFlux Express ${trainNo}`;
    lines.push(
      `INSERT INTO trains (train_no, name, source, destination) VALUES (${sqlString(trainNo)}, ${sqlString(name)}, ${sqlString(source)}, ${sqlString(dest)});`,
    );
  }

  const journeyDate = '2026-04-01';
  const trainRunIds = [];
  for (let r = 0; r < manifest.trainRuns; r += 1) {
    const id = uuidFromRng(rng);
    trainRunIds.push(id);
    const trainNo = String(10001 + (r % manifest.trains)).padStart(5, '0');
    lines.push(
      `INSERT INTO train_runs (id, train_no, journey_date) VALUES (${sqlString(id)}, ${sqlString(trainNo)}, ${sqlString(journeyDate)});`,
    );
  }

  for (let r = 0; r < trainRunIds.length; r += 1) {
    const seats =
      r < manifest.hotTrainRuns ? manifest.seatsPerHotBucket : 500;
    for (const classCode of manifest.classes) {
      const invId = uuidFromRng(rng);
      lines.push(
        `INSERT INTO seat_inventory (id, train_run_id, fixture_id, class_code, quota, initial_seats, available_seats, version) VALUES (${sqlString(invId)}, ${sqlString(trainRunIds[r])}, ${sqlString(manifest.fixtureId)}, ${sqlString(classCode)}, ${sqlString(manifest.quota)}, ${seats}, ${seats}, 0);`,
      );
    }
  }

  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
