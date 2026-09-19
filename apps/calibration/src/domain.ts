import { CURRENT, type TierId } from '@dm/content';
import { cloneState, createState, step } from '@dm/engine';
import type { GameState } from '@dm/engine';
import Decimal from 'break_eternity.js';

export type Prediction = { readonly p: number; readonly ms: number };

export interface Predictor {
  readonly name: string;
  readonly predict: (question: Question) => Promise<Prediction>;
}

export interface Question {
  readonly seed: number;
  readonly state: GameState;
  readonly text: string;
  readonly horizonTicks: number;
  readonly threshold: number;
  readonly baseRate: number;
  readonly trueOutcome: boolean;
}

export interface RoundLog {
  readonly seed: number;
  readonly question: string;
  readonly horizonTicks: number;
  readonly predictions: Readonly<Record<string, Prediction>>;
  readonly outcome: boolean;
}

export const BASE_RATE = 0.5;

export function questionForSeed(seed: number, baseRate = BASE_RATE): Question {
  const random = mulberry32(seed);
  const state = createState(CURRENT);
  const minions = 1 + Math.floor(random() * 12);
  const horizonTicks = 20 + Math.floor(random() * 80);
  state.gens.minion.owned = new Decimal(minions);
  state.gens.minion.running = true;
  const future = cloneState(state);
  for (let tick = 0; tick < horizonTicks; tick += 1) step(future, CURRENT, 100);
  const gain = future.resources.evil.sub(state.resources.evil).toNumber();
  const threshold = gain * (seed % 2 === 0 ? 0.75 : 1.25);
  const trueOutcome = gain >= threshold;
  const seconds = Math.round(horizonTicks / 10);
  return {
    seed,
    state: cloneState(state),
    text: `Will this state produce at least ${formatNumber(threshold)} Evil in the next ${seconds} seconds?`,
    horizonTicks,
    threshold,
    baseRate,
    trueOutcome,
  };
}

export function baselinePredictor(): Predictor {
  return {
    name: 'base-rate baseline',
    predict: async (question) => ({ p: question.baseRate, ms: 0 }),
  };
}

export function humanPredictor(readProbability: () => number): Predictor {
  return {
    name: 'human',
    predict: async () => ({ p: clamp(readProbability()), ms: 0 }),
  };
}

export function buildSession(count: number): Question[] {
  const questions = Array.from({ length: count }, (_, index) => questionForSeed(index + 1));
  const achieved = questions.filter(({ trueOutcome }) => trueOutcome).length / questions.length;
  return questions.map((question) => ({ ...question, baseRate: achieved }));
}

export function toLogLine(round: RoundLog): string {
  return JSON.stringify(round);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatNumber(value: number): string {
  return value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toFixed(1);
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stateSummary(state: GameState): string {
  const counts: Partial<Record<TierId, string>> = {};
  for (const tier of Object.keys(state.gens) as TierId[]) counts[tier] = state.gens[tier].owned.toString();
  return Object.entries(counts).map(([tier, count]) => `${tier}: ${count}`).join(' · ');
}
