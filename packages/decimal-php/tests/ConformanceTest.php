<?php

declare(strict_types=1);

use DreadMajesty\Decimal\Decimal;
use DreadMajesty\Decimal\Reconciler;

$vectorsPath = dirname(__DIR__, 2) . '/engine/conformance/vectors/v1.json';

if (!file_exists($vectorsPath)) {
    test('conformance vectors not found', function () use ($vectorsPath) {
        $this->markTestSkipped("v1.json not found at {$vectorsPath}");
    });

    return;
}

$file = json_decode(file_get_contents($vectorsPath), true, 512, JSON_THROW_ON_ERROR);
$content = $file['chain'];
$vectors = $file['vectors'];

foreach ($vectors as $vector) {
    $label = $vector['label'];
    $kind = $vector['kind'];
    $tolerance = $vector['tolerance'] !== null ? (float) $vector['tolerance'] : null;

    test("conformance vector: {$label} ({$kind})", function () use ($vector, $content, $tolerance) {
        $state = Reconciler::deserializeState($vector['startState'], $content);
        $result = Reconciler::catchUp($state, $content, $vector['elapsedMs']);
        $actualBlob = Reconciler::serializeState($state, $content);

        $errors = [];

        // Compare resources
        foreach ($vector['expected']['endState']['resources'] as $key => $expected) {
            $actual = $actualBlob['resources'][$key] ?? '0';
            $err = compareDecimalValue("resources.{$key}", $actual, $expected, $tolerance);
            if ($err !== null) {
                $errors[] = $err;
            }
        }

        // Compare gens
        foreach ($vector['expected']['endState']['gens'] as $key => $expectedGen) {
            $actualGen = $actualBlob['gens'][$key] ?? null;
            if ($actualGen === null) {
                $errors[] = "gens.{$key}: missing";

                continue;
            }

            $err = compareDecimalValue("gens.{$key}.owned", $actualGen['owned'], $expectedGen['owned'], $tolerance);
            if ($err !== null) {
                $errors[] = $err;
            }

            $err = compareDecimalValue(
                "gens.{$key}.lifetimeProduced",
                $actualGen['lifetimeProduced'],
                $expectedGen['lifetimeProduced'],
                $tolerance,
            );
            if ($err !== null) {
                $errors[] = $err;
            }

            if (isset($expectedGen['purchased'])) {
                $err = compareDecimalValue(
                    "gens.{$key}.purchased",
                    $actualGen['purchased'] ?? '0',
                    $expectedGen['purchased'],
                    $tolerance,
                );
                if ($err !== null) {
                    $errors[] = $err;
                }
            }

            if ($actualGen['progressMs'] !== $expectedGen['progressMs']) {
                $errors[] = "gens.{$key}.progressMs: expected {$expectedGen['progressMs']}, got {$actualGen['progressMs']}";
            }

            if ($actualGen['running'] !== $expectedGen['running']) {
                $exp = $expectedGen['running'] ? 'true' : 'false';
                $act = $actualGen['running'] ? 'true' : 'false';
                $errors[] = "gens.{$key}.running: expected {$exp}, got {$act}";
            }
        }

        // Compare scalars
        $err = compareDecimalValue('souls', $actualBlob['souls'], $vector['expected']['endState']['souls'], $tolerance);
        if ($err !== null) {
            $errors[] = $err;
        }

        $err = compareDecimalValue('lifetimeEvil', $actualBlob['lifetimeEvil'], $vector['expected']['endState']['lifetimeEvil'], $tolerance);
        if ($err !== null) {
            $errors[] = $err;
        }

        if (isset($vector['expected']['endState']['soulsSpent'])) {
            $err = compareDecimalValue(
                'soulsSpent',
                $actualBlob['soulsSpent'] ?? '0',
                $vector['expected']['endState']['soulsSpent'],
                $tolerance,
            );
            if ($err !== null) {
                $errors[] = $err;
            }
        }

        // Compare stats
        $expectedStats = $vector['expected']['endState']['stats'];
        $actualStats = $actualBlob['stats'];
        if ($actualStats['playTimeMs'] !== $expectedStats['playTimeMs']) {
            $errors[] = "stats.playTimeMs: expected {$expectedStats['playTimeMs']}, got {$actualStats['playTimeMs']}";
        }
        if ($actualStats['runMs'] !== $expectedStats['runMs']) {
            $errors[] = "stats.runMs: expected {$expectedStats['runMs']}, got {$actualStats['runMs']}";
        }

        // Compare smite state
        $expectedEnd = $vector['expected']['endState'];
        if (($actualBlob['smiteActiveMs'] ?? 0) !== ($expectedEnd['smiteActiveMs'] ?? 0)) {
            $errors[] = 'smiteActiveMs: expected ' . ($expectedEnd['smiteActiveMs'] ?? 0) . ', got ' . ($actualBlob['smiteActiveMs'] ?? 0);
        }
        if (($actualBlob['smiteCooldownMs'] ?? 0) !== ($expectedEnd['smiteCooldownMs'] ?? 0)) {
            $errors[] = 'smiteCooldownMs: expected ' . ($expectedEnd['smiteCooldownMs'] ?? 0) . ', got ' . ($actualBlob['smiteCooldownMs'] ?? 0);
        }

        // Compare produced
        $actualProduced = [];
        foreach ($result['produced'] as $id => $amount) {
            $actualProduced[$id] = (string) $amount;
        }
        $expectedProduced = $vector['expected']['produced'];
        $allKeys = array_unique(array_merge(array_keys($expectedProduced), array_keys($actualProduced)));
        foreach ($allKeys as $key) {
            $err = compareDecimalValue(
                "produced.{$key}",
                $actualProduced[$key] ?? '0',
                $expectedProduced[$key] ?? '0',
                $tolerance,
            );
            if ($err !== null) {
                $errors[] = $err;
            }
        }

        expect($errors)->toBe([], implode("\n", $errors));
    });
}

function compareDecimalValue(string $path, string $actual, string $expected, ?float $tolerance): ?string
{
    if ($tolerance === null) {
        // Exact match
        if ($actual !== $expected) {
            return "{$path}: expected \"{$expected}\", got \"{$actual}\"";
        }

        return null;
    }

    $da = Decimal::fromString($actual);
    $de = Decimal::fromString($expected);

    if ($de->eq(Decimal::zero())) {
        if ($da->eq(Decimal::zero())) {
            return null;
        }

        return "{$path}: expected 0, got \"{$actual}\"";
    }

    $relError = $da->sub($de)->abs()->div($de->abs())->toNumber();

    if ($relError > $tolerance) {
        $relStr = sprintf('%.3e', $relError);

        return "{$path}: relative error {$relStr} exceeds {$tolerance} (expected \"{$expected}\", got \"{$actual}\")";
    }

    return null;
}
