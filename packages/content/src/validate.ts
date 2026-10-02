import {
  SMITE_UPGRADE_IDS,
  isAchievementId,
  isOverseerId,
  isResourceId,
  isSmiteUpgradeId,
  isTierId,
} from './ids.ts';
import type {
  AchievementCondition,
  AchievementDef,
  Content,
  MilestoneDef,
  OverseerDef,
  OverseerEffect,
  PrestigeDef,
  SmiteDef,
  SmiteRungDef,
  SmiteUpgradeDef,
  TierDef,
} from './types.ts';

/**
 * Whether a value that arrived from outside the bundle is a `Content` the engine can run.
 *
 * The client fetches a published chain as JSON (plan §7), and JSON is `unknown` until
 * this says otherwise. It checks shape and the few invariants the engine leans on
 * without checking them itself: no tier named twice, every smite ladder present exactly
 * once, and milestones ascending. A chain may carry fewer than every tier — the engine
 * runs on whatever tiers it is given, and its own fixtures carry two. Balance is not its business — the backstage validates that
 * before it will publish.
 *
 * A figure that feeds a `Decimal` must be a plain decimal string. `new Decimal('lots')`
 * reads as zero rather than refusing, so a word here would not fail — it would quietly
 * price something at nothing.
 */
export function isContent(value: unknown): value is Content {
  return (
    isRecord(value) &&
    isText(value['version']) &&
    isArrayOf(value['tiers'], isTierDef) &&
    isUnique(value['tiers']) &&
    isArrayOf(value['milestones'], isMilestoneDef) &&
    isAscending(value['milestones']) &&
    isArrayOf(value['achievements'], isAchievementDef) &&
    isPositive(value['unlockFraction']) &&
    isPrestigeDef(value['prestige']) &&
    isWholeMs(value['offlineCapMs']) &&
    isSmiteDef(value['smite'])
  );
}

const DECIMAL_STRING = /^\d+(\.\d+)?(e\+?\d+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL_STRING.test(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isWholeMs(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value > 0;
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

function isUnique(items: readonly { readonly id: string }[]): boolean {
  return items.length > 0 && new Set(items.map((item) => item.id)).size === items.length;
}

/** Each id in `ids` exactly once, and nothing else. */
function everyOnce<T extends { readonly id: string }>(
  value: unknown,
  guard: (item: unknown) => item is T,
  ids: readonly string[],
): value is T[] {
  if (!isArrayOf(value, guard) || value.length !== ids.length) return false;
  const seen = new Set(value.map((item) => item.id));
  return seen.size === ids.length && ids.every((id) => seen.has(id));
}

function isAscending(milestones: readonly MilestoneDef[]): boolean {
  return milestones.every(
    (rung, index) => index === 0 || rung.at > (milestones[index - 1]?.at ?? 0),
  );
}

function isOverseerEffect(value: unknown): value is OverseerEffect {
  if (!isRecord(value)) return false;
  if (value['kind'] === 'automate') return true;
  return (value['kind'] === 'quicken' || value['kind'] === 'swell') && isPositive(value['factor']);
}

function isOverseerDef(value: unknown): value is OverseerDef {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    isOverseerId(value['id']) &&
    isText(value['name']) &&
    isDecimalString(value['cost']) &&
    isOverseerEffect(value['effect'])
  );
}

function isTierDef(value: unknown): value is TierDef {
  if (!isRecord(value)) return false;
  const { id, produces, costResource } = value;
  return (
    typeof id === 'string' &&
    isTierId(id) &&
    isText(value['name']) &&
    isText(value['plural']) &&
    typeof produces === 'string' &&
    (isTierId(produces) || isResourceId(produces)) &&
    isDecimalString(value['yield']) &&
    isWholeMs(value['cycleMs']) &&
    typeof costResource === 'string' &&
    isResourceId(costResource) &&
    isDecimalString(value['baseCost']) &&
    isPositive(value['costRate']) &&
    isArrayOf(value['overseers'], isOverseerDef) &&
    isText(value['art'])
  );
}

function isMilestoneDef(value: unknown): value is MilestoneDef {
  return isRecord(value) && isPositive(value['at']) && isPositive(value['multiplier']);
}

function isAchievementCondition(value: unknown): value is AchievementCondition {
  if (!isRecord(value)) return false;
  const { kind, atLeast, tierId } = value;
  switch (kind) {
    case 'tier-owned':
      return typeof tierId === 'string' && isTierId(tierId) && isDecimalString(atLeast);
    case 'lifetime-evil':
    case 'souls':
      return isDecimalString(atLeast);
    case 'prestiges':
    case 'smites':
      return Number.isSafeInteger(atLeast);
    default:
      return false;
  }
}

function isAchievementDef(value: unknown): value is AchievementDef {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    isAchievementId(value['id']) &&
    isText(value['name']) &&
    isText(value['description']) &&
    isAchievementCondition(value['condition']) &&
    isPositive(value['multiplier'])
  );
}

function isPrestigeDef(value: unknown): value is PrestigeDef {
  return (
    isRecord(value) &&
    isPositive(value['k']) &&
    isDecimalString(value['scale']) &&
    isPositive(value['exponent']) &&
    isFiniteNumber(value['perSoul'])
  );
}

function isSmiteRungDef(value: unknown): value is SmiteRungDef {
  return (
    isRecord(value) &&
    isDecimalString(value['evil']) &&
    isDecimalString(value['souls']) &&
    isFiniteNumber(value['value'])
  );
}

function isSmiteUpgradeDef(value: unknown): value is SmiteUpgradeDef {
  const units: readonly unknown[] = ['seconds', 'multiplier', 'amount'];
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    isSmiteUpgradeId(value['id']) &&
    isText(value['name']) &&
    isFiniteNumber(value['base']) &&
    units.includes(value['unit']) &&
    isArrayOf(value['rungs'], isSmiteRungDef)
  );
}

function isSmiteDef(value: unknown): value is SmiteDef {
  if (!isRecord(value)) return false;
  const { apathy } = value;
  return (
    isWholeMs(value['cooldownMs']) &&
    isRecord(apathy) &&
    isFiniteNumber(apathy['perBlow']) &&
    isFiniteNumber(apathy['cap']) &&
    isPositive(value['climbGrowth']) &&
    everyOnce(value['upgrades'], isSmiteUpgradeDef, SMITE_UPGRADE_IDS)
  );
}
