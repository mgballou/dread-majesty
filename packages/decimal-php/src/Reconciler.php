<?php

declare(strict_types=1);

namespace DreadMajesty\Decimal;

/**
 * Deterministic fixed-step reconciler over a declared production graph.
 *
 * Ports the engine's step() and catchUp() against the conformance chain.
 * The chain is the Content object from v1.json, not the shipping content.
 */
final class Reconciler
{
    private const BASE_DT_MS = 100;

    private const COARSE_DT_MS = 1000;

    private const COARSEN_ABOVE_MS = 3_600_000;

    /**
     * Run catchUp: call step in a loop for the given elapsed time.
     *
     * @param  array<string, mixed>  $state  Deserialized GameState
     * @param  array<string, mixed>  $content  The chain (Content object)
     * @param  int  $elapsedMs  Milliseconds to catch up
     * @return array{state: array<string, mixed>, produced: array<string, Decimal>}
     */
    public static function catchUp(array &$state, array $content, int $elapsedMs): array
    {
        $clamped = max(0, $elapsedMs);
        $capped = min($clamped, $content['offlineCapMs']);
        $coarsened = $capped > self::COARSEN_ABOVE_MS;
        $dt = $coarsened ? self::COARSE_DT_MS : self::BASE_DT_MS;

        /** @var array<string, Decimal> $produced */
        $produced = [];
        $whole = intdiv($capped, $dt);

        for ($i = 0; $i < $whole; $i++) {
            $report = self::step($state, $content, $dt);
            self::accumulate($produced, $report);
        }

        $remainder = $capped - $whole * $dt;
        if ($remainder > 0) {
            $report = self::step($state, $content, $remainder);
            self::accumulate($produced, $report);
        }

        $state['stats']['playTimeMs'] += $capped;
        $state['stats']['runMs'] += $capped;

        return ['state' => $state, 'produced' => $produced];
    }

    /**
     * One simulation step.
     *
     * @return array<string, Decimal>
     */
    public static function step(array &$state, array $content, int $dtMs): array
    {
        // Smite countdowns
        $state['smiteActiveMs'] = max(0, ($state['smiteActiveMs'] ?? 0) - $dtMs);
        $state['smiteCooldownMs'] = max(0, ($state['smiteCooldownMs'] ?? 0) - $dtMs);

        if (($state['smiteActiveMs'] ?? 0) <= 0) {
            $state['smiteBlow'] = 1;
        }

        // Apathy bleed
        $bleedMs = self::smiteBleedMs($state, $content);
        if ($bleedMs > 0) {
            $state['smiteApathy'] = max(0, ($state['smiteApathy'] ?? 0) - $dtMs / $bleedMs);
        }

        // Snapshot owned counts
        $owned = [];
        foreach ($content['tiers'] as $tier) {
            $id = $tier['id'];
            $owned[$id] = $state['gens'][$id]['owned'];
        }

        /** @var array<string, Decimal> $delta */
        $delta = [];

        foreach ($content['tiers'] as $tier) {
            $id = $tier['id'];
            $gen = &$state['gens'][$id];
            $appointed = self::hasAutomator($state, $tier);

            if (!$appointed && !$gen['running']) {
                continue;
            }

            $cycleMs = self::effectiveCycleMs($state, $tier);
            $gen['progressMs'] += $dtMs;
            $cycles = intdiv($gen['progressMs'], $cycleMs);

            if ($appointed) {
                if ($cycles > 0) {
                    $gen['progressMs'] -= $cycles * $cycleMs;
                }
            } elseif ($cycles > 0) {
                $cycles = 1;
                $gen['progressMs'] = 0;
                $gen['running'] = false;
            }

            /** @var Decimal $count */
            $count = $owned[$id];
            if ($cycles <= 0 || $count->lte(Decimal::zero())) {
                continue;
            }

            $yieldVal = self::effectiveYield($state, $tier);
            $mult = self::tierMultiplier($state, $content, $count);
            $amount = $count->mul($yieldVal)->mul(Decimal::fromNumber((float) $cycles))->mul($mult);

            $produces = $tier['produces'];
            $delta[$produces] = isset($delta[$produces])
                ? $delta[$produces]->add($amount)
                : $amount;

            $gen['lifetimeProduced'] = $gen['lifetimeProduced']->add($amount);
        }

        // Commit delta
        self::commit($state, $content, $delta);

        return $delta;
    }

    private static function commit(array &$state, array $content, array $delta): void
    {
        $tierIds = array_map(fn (array $t) => $t['id'], $content['tiers']);

        foreach ($delta as $id => $amount) {
            if (in_array($id, $tierIds, true)) {
                $state['gens'][$id]['owned'] = $state['gens'][$id]['owned']->add($amount);

                continue;
            }

            // Resource (evil)
            if (isset($state['resources'][$id])) {
                $state['resources'][$id] = $state['resources'][$id]->add($amount);
                if ($id === 'evil') {
                    $state['lifetimeEvil'] = $state['lifetimeEvil']->add($amount);
                }
            }
        }
    }

    /**
     * @param  array<string, Decimal>  $into
     * @param  array<string, Decimal>  $report
     */
    private static function accumulate(array &$into, array $report): void
    {
        foreach ($report as $id => $amount) {
            $into[$id] = isset($into[$id])
                ? $into[$id]->add($amount)
                : $amount;
        }
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $tier
     */
    private static function hasAutomator(array $state, array $tier): bool
    {
        foreach ($tier['overseers'] as $post) {
            if ($post['effect']['kind'] === 'automate'
                && in_array($post['id'], $state['overseers'][$tier['id']] ?? [], true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $tier
     */
    private static function effectiveCycleMs(array $state, array $tier): int
    {
        $factor = 1.0;
        foreach ($tier['overseers'] as $post) {
            if ($post['effect']['kind'] !== 'quicken') {
                continue;
            }
            if (in_array($post['id'], $state['overseers'][$tier['id']] ?? [], true)) {
                $factor *= $post['effect']['factor'];
            }
        }

        return max(1, (int) round($tier['cycleMs'] / $factor));
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $tier
     */
    private static function effectiveYield(array $state, array $tier): Decimal
    {
        $amount = Decimal::fromString($tier['yield']);
        foreach ($tier['overseers'] as $post) {
            if ($post['effect']['kind'] !== 'swell') {
                continue;
            }
            if (in_array($post['id'], $state['overseers'][$tier['id']] ?? [], true)) {
                $amount = $amount->mul(Decimal::fromNumber((float) $post['effect']['factor']));
            }
        }

        return $amount;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $content
     */
    private static function tierMultiplier(array $state, array $content, Decimal $owned): Decimal
    {
        $multiplier = Decimal::one();
        foreach ($content['milestones'] as $milestone) {
            $at = Decimal::fromString((string) $milestone['at']);
            if ($owned->lt($at)) {
                break;
            }
            $multiplier = $multiplier->mul(
                Decimal::fromNumber((float) $milestone['multiplier'])
            );
        }

        return $multiplier->mul(self::globalMultiplier($state, $content));
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $content
     */
    private static function globalMultiplier(array $state, array $content): Decimal
    {
        /** @var Decimal $souls */
        $souls = $state['souls'];
        $perSoul = $content['prestige']['perSoul'];
        $fromSouls = Decimal::one()->add($souls->mul(Decimal::fromNumber($perSoul)));

        $fromSmite = ($state['smiteActiveMs'] ?? 0) > 0 ? ($state['smiteBlow'] ?? 1) : 1;

        $achMul = self::achievementMultiplier($state, $content);

        return $fromSouls->mul($achMul)->mul(Decimal::fromNumber((float) $fromSmite));
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $content
     */
    private static function achievementMultiplier(array $state, array $content): Decimal
    {
        $multiplier = Decimal::one();
        foreach ($content['achievements'] as $achievement) {
            if ($achievement['multiplier'] === 1) {
                continue;
            }
            if (in_array($achievement['id'], $state['earnedAchievements'] ?? [], true)) {
                $multiplier = $multiplier->mul(
                    Decimal::fromNumber((float) $achievement['multiplier'])
                );
            }
        }

        return $multiplier;
    }

    private static function smiteBleedMs(array $state, array $content): float
    {
        return self::smiteValueNow($state, $content, 'forgetting');
    }

    private static function smiteValueNow(array $state, array $content, string $id): float
    {
        $upgrade = null;
        foreach ($content['smite']['upgrades'] as $u) {
            if ($u['id'] === $id) {
                $upgrade = $u;

                break;
            }
        }
        if ($upgrade === null) {
            return 0.0;
        }
        $rung = $state['smiteRungs'][$id] ?? 0;
        if ($rung <= 0 || empty($upgrade['rungs'])) {
            return (float) $upgrade['base'];
        }
        $effectiveRung = min($rung, count($upgrade['rungs']));

        return (float) $upgrade['rungs'][$effectiveRung - 1]['value'];
    }

    /**
     * Deserialize a SaveBlob from v1.json into a working state with Decimals.
     *
     * @param  array<string, mixed>  $blob
     * @param  array<string, mixed>  $content
     * @return array<string, mixed>
     */
    public static function deserializeState(array $blob, array $content): array
    {
        $state = [];
        $state['saveVersion'] = $blob['saveVersion'];

        // Resources
        $state['resources'] = [];
        foreach ($blob['resources'] as $id => $val) {
            $state['resources'][$id] = Decimal::fromString((string) $val);
        }

        // Generators — include every tier in the blob, not just those in content.
        // The vectors carry five tiers but the conformance chain only defines two.
        $state['gens'] = [];
        $allTierIds = array_unique(array_merge(
            array_map(fn (array $t) => $t['id'], $content['tiers']),
            array_keys($blob['gens'] ?? []),
        ));
        foreach ($allTierIds as $id) {
            $saved = $blob['gens'][$id] ?? null;
            $state['gens'][$id] = [
                'owned' => Decimal::fromString((string) ($saved['owned'] ?? '0')),
                'progressMs' => $saved['progressMs'] ?? 0,
                'lifetimeProduced' => Decimal::fromString((string) ($saved['lifetimeProduced'] ?? '0')),
                'running' => $saved['running'] ?? false,
                'purchased' => Decimal::fromString((string) ($saved['purchased'] ?? '0')),
            ];
        }

        $state['souls'] = Decimal::fromString((string) ($blob['souls'] ?? '0'));
        $state['soulsSpent'] = Decimal::fromString((string) ($blob['soulsSpent'] ?? '0'));
        $state['lifetimeEvil'] = Decimal::fromString((string) ($blob['lifetimeEvil'] ?? '0'));
        $state['earnedAchievements'] = $blob['earnedAchievements'] ?? [];
        $state['unlocked'] = $blob['unlocked'] ?? [];
        $state['overseers'] = $blob['overseers'] ?? [];
        $state['smiteActiveMs'] = $blob['smiteActiveMs'] ?? 0;
        $state['smiteCooldownMs'] = $blob['smiteCooldownMs'] ?? 0;
        $state['smiteApathy'] = $blob['smiteApathy'] ?? 0;
        $state['smiteBlow'] = $blob['smiteBlow'] ?? 1;
        $state['smiteRungs'] = $blob['smiteRungs'] ?? [];
        $state['smiteKept'] = $blob['smiteKept'] ?? [];
        $state['stats'] = $blob['stats'] ?? ['playTimeMs' => 0, 'smites' => 0, 'prestiges' => 0, 'runMs' => 0];

        return $state;
    }

    /**
     * Serialize the working state back to a SaveBlob.
     *
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $content
     * @return array<string, mixed>
     */
    public static function serializeState(array $state, array $content): array
    {
        $blob = [];
        $blob['saveVersion'] = $state['saveVersion'];

        $blob['resources'] = [];
        foreach ($state['resources'] as $id => $val) {
            $blob['resources'][$id] = (string) $val;
        }

        $blob['gens'] = [];
        foreach (array_keys($state['gens']) as $id) {
            $gen = $state['gens'][$id];
            $blob['gens'][$id] = [
                'owned' => (string) $gen['owned'],
                'progressMs' => $gen['progressMs'],
                'lifetimeProduced' => (string) $gen['lifetimeProduced'],
                'running' => $gen['running'],
                'purchased' => (string) $gen['purchased'],
            ];
        }

        $blob['souls'] = (string) $state['souls'];
        $blob['lifetimeEvil'] = (string) $state['lifetimeEvil'];
        $blob['earnedAchievements'] = $state['earnedAchievements'];
        $blob['unlocked'] = $state['unlocked'];
        $blob['overseers'] = $state['overseers'];
        $blob['smiteActiveMs'] = $state['smiteActiveMs'];
        $blob['smiteCooldownMs'] = $state['smiteCooldownMs'];
        $blob['smiteApathy'] = $state['smiteApathy'];
        $blob['smiteBlow'] = $state['smiteBlow'];
        $blob['smiteRungs'] = $state['smiteRungs'];
        $blob['smiteKept'] = $state['smiteKept'];
        $blob['soulsSpent'] = (string) $state['soulsSpent'];
        $blob['stats'] = $state['stats'];

        return $blob;
    }
}
