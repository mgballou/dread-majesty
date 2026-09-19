import { readFile } from 'node:fs/promises';
import { brierScore, reliabilityCurve } from '../src/metrics.ts';

const path = process.argv[2];
if (!path) throw new Error('Usage: pnpm --filter @dm/calibration report -- path/to/session.ndjson');
const lines = (await readFile(path, 'utf8')).split('\n').filter(Boolean);
const rounds = lines.map((line) => JSON.parse(line));
const names = [...new Set(rounds.flatMap((round) => Object.keys(round.predictions)))];
const baseRate = rounds.filter((round) => round.outcome).length / rounds.length;
console.log(`Rounds: ${rounds.length}`);
console.log(`Base rate: ${(baseRate * 100).toFixed(1)}%`);
for (const name of names) {
  const scored = rounds.map((round) => ({ p: round.predictions[name].p, outcome: Number(round.outcome) === 1 ? 1 : 0 }));
  const latency = rounds.reduce((sum, round) => sum + round.predictions[name].ms, 0) / rounds.length;
  console.log(`\n${name}`);
  console.log(`  Brier: ${brierScore(scored).toFixed(4)}`);
  console.log(`  Count: ${scored.length}`);
  console.log(`  Mean latency: ${latency.toFixed(1)} ms`);
  console.log(`  Reliability: ${JSON.stringify(reliabilityCurve(scored))}`);
}
console.log(`\nBase-rate-only Brier: ${(baseRate * (1 - baseRate)).toFixed(4)}`);
