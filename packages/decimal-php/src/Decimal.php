<?php

declare(strict_types=1);

namespace DreadMajesty\Decimal;

use Stringable;

/**
 * Port of break_eternity.js's three-field Decimal.
 *
 * sign * 10^10^10...^mag with (layer) 10s.
 * Immutable — every operation returns a new Decimal.
 */
final class Decimal implements Stringable
{
    private const EXP_LIMIT = 9e15;

    private const LAYER_DOWN = 15.954589770191003; // log10(9e15)

    private const FIRST_NEG_LAYER = 1.1111111111111112e-16; // 1/9e15

    private const MAX_SIGNIFICANT_DIGITS = 17;

    private const NUMBER_EXP_MAX = 308;

    private const NUMBER_EXP_MIN = -324;

    /** @var array<int, float> */
    private static array $powersOf10Cache = [];

    public function __construct(
        public readonly int $sign,
        public readonly int $layer,
        public readonly float $mag,
    ) {}

    public static function zero(): self
    {
        return new self(0, 0, 0);
    }

    public static function one(): self
    {
        return new self(1, 0, 1);
    }

    /**
     * Build from components and normalize.
     */
    public static function fromComponents(int $sign, int $layer, float $mag): self
    {
        return self::normalize($sign, $layer, $mag);
    }

    public static function fromNumber(float $value): self
    {
        if (is_nan($value)) {
            return new self(0, 0, NAN);
        }
        if ($value === 0.0) {
            return self::zero();
        }

        return self::normalize(
            $value > 0 ? 1 : -1,
            0,
            abs($value),
        );
    }

    public static function fromString(string $value): self
    {
        $value = trim($value);

        if ($value === 'NaN' || $value === '') {
            return new self(0, 0, NAN);
        }
        if ($value === 'Infinity' || $value === '+Infinity') {
            return new self(1, PHP_INT_MAX, INF);
        }
        if ($value === '-Infinity') {
            return new self(-1, PHP_INT_MAX, INF);
        }

        // Try as a plain number first
        if (preg_match('/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/', $value)) {
            $num = (float) $value;
            if (is_finite($num)) {
                return self::fromNumber($num);
            }
            // Overflow — parse mantissa and exponent separately
            if (preg_match('/^([+-]?\d+\.?\d*)[eE]([+-]?\d+)$/', $value, $m)) {
                $mantissa = (float) $m[1];
                $exponent = (int) $m[2];
                $sign = $mantissa >= 0 ? 1 : -1;
                $mantissa = abs($mantissa);
                if ($mantissa === 0.0) {
                    return self::zero();
                }

                return self::normalize(
                    $sign,
                    1,
                    $exponent + V8Math::log10($mantissa),
                );
            }
        }

        // Try as a plain float (handles things like "1e100")
        $num = filter_var($value, FILTER_VALIDATE_FLOAT);
        if ($num !== false) {
            return self::fromNumber($num);
        }

        return new self(0, 0, NAN);
    }

    /**
     * Normalize the three-field representation.
     *
     * Transliterated from break_eternity.js Decimal.prototype.normalize().
     */
    private static function normalize(int $sign, int $layer, float $mag): self
    {
        if ($sign === 0 || ($mag === 0.0 && $layer === 0)) {
            return self::zero();
        }

        if (!is_finite($mag)) {
            if (is_nan($mag)) {
                return new self(0, 0, NAN);
            }
            if ($mag === INF) {
                return new self($sign, PHP_INT_MAX, INF);
            }
            // -INF mag at layer > 0 means zero
            if ($layer > 0) {
                return self::zero();
            }

            return new self(0, 0, NAN);
        }

        if ($layer === 0 && $mag < 0) {
            $mag = -$mag;
            $sign = -$sign;
        }

        if ($layer === 0 && $mag < self::FIRST_NEG_LAYER && $mag !== 0.0) {
            $layer += 1;
            $mag = V8Math::log10($mag);

            return new self($sign, $layer, $mag);
        }

        $absmag = abs($mag);
        $signmag = $mag >= 0 ? 1.0 : -1.0;
        if ($mag === 0.0) {
            $signmag = 0.0;
        }

        if ($absmag >= self::EXP_LIMIT) {
            $layer += 1;
            $mag = $signmag * V8Math::log10($absmag);

            return new self($sign, $layer, $mag);
        }

        while ($absmag < self::LAYER_DOWN && $layer > 0) {
            $layer -= 1;
            if ($layer === 0) {
                $mag = V8Math::pow10($mag);
            } else {
                $mag = $signmag * V8Math::pow10($absmag);
                $absmag = abs($mag);
                $signmag = $mag >= 0 ? 1.0 : -1.0;
                if ($mag === 0.0) {
                    $signmag = 0.0;
                }
            }
        }

        if ($layer === 0) {
            if ($mag < 0) {
                $mag = -$mag;
                $sign = -$sign;
            } elseif ($mag === 0.0) {
                $sign = 0;
            }
        }

        return new self($sign, $layer, $mag);
    }

    public function toNumber(): float
    {
        if ($this->isNan()) {
            return NAN;
        }
        if ($this->isInfinite()) {
            return $this->sign === 1 ? INF : -INF;
        }
        if ($this->layer === 0) {
            return $this->sign * $this->mag;
        }
        if ($this->layer === 1) {
            return $this->sign * V8Math::pow10($this->mag);
        }

        return $this->mag > 0
            ? ($this->sign > 0 ? INF : -INF)
            : 0.0;
    }

    public function __toString(): string
    {
        if ($this->isNan()) {
            return 'NaN';
        }
        if ($this->isInfinite()) {
            return $this->sign === 1 ? 'Infinity' : '-Infinity';
        }

        if ($this->layer === 0) {
            $val = $this->sign * $this->mag;
            if (($this->mag < 1e21 && $this->mag > 1e-7) || $this->mag === 0.0) {
                // Match JS's toString for plain numbers
                return self::jsNumberToString($val);
            }

            return $this->mantissaExponentString();
        }

        if ($this->layer === 1) {
            return $this->mantissaExponentString();
        }

        $prefix = $this->sign === -1 ? '-' : '';

        return $prefix . str_repeat('e', $this->layer) . self::jsNumberToString($this->mag);
    }

    /**
     * Match JavaScript's number-to-string for IEEE 754 doubles.
     */
    private static function jsNumberToString(float $val): string
    {
        if ($val === 0.0) {
            // Distinguish -0 from +0 is unnecessary here for break_eternity's use
            return '0';
        }
        // PHP and JS both use IEEE 754 doubles, and for most values their
        // string representations agree. The exceptions are rare edge cases.
        // Using sprintf with enough digits to round-trip.
        $s = sprintf('%.17G', $val);
        // Trim trailing zeros after decimal point, but keep at least one
        if (str_contains($s, '.') && !str_contains($s, 'E')) {
            $s = rtrim($s, '0');
            $s = rtrim($s, '.');
        }

        return $s;
    }

    private function mantissaExponentString(): string
    {
        $e = $this->exponent();
        $m = $this->mantissa();

        return $m . 'e' . $e;
    }

    public function mantissa(): float
    {
        if ($this->sign === 0) {
            return 0;
        }
        if ($this->layer === 0) {
            $exp = (int) floor(V8Math::log10($this->mag));
            if ($this->mag === 5e-324) {
                return $this->sign * 5;
            }

            return $this->sign * $this->mag / self::powerOf10($exp);
        }
        if ($this->layer === 1) {
            $residue = $this->mag - floor($this->mag);

            return $this->sign * V8Math::pow10($residue);
        }

        return (float) $this->sign;
    }

    public function exponent(): int
    {
        if ($this->sign === 0) {
            return 0;
        }
        if ($this->layer === 0) {
            return (int) floor(V8Math::log10($this->mag));
        }
        if ($this->layer === 1) {
            return (int) floor($this->mag);
        }
        if ($this->layer === 2) {
            return (int) floor(
                ($this->mag >= 0 ? 1 : -1) * V8Math::pow10(abs($this->mag))
            );
        }

        return $this->mag > 0 ? PHP_INT_MAX : PHP_INT_MIN;
    }

    private static function powerOf10(int $power): float
    {
        if (empty(self::$powersOf10Cache)) {
            for ($i = self::NUMBER_EXP_MIN + 1; $i <= self::NUMBER_EXP_MAX; $i++) {
                self::$powersOf10Cache[$i] = (float) ('1e' . $i);
            }
        }

        return self::$powersOf10Cache[$power] ?? V8Math::pow10((float) $power);
    }

    // --- Predicates ---

    public function isNan(): bool
    {
        return is_nan($this->mag);
    }

    public function isInfinite(): bool
    {
        return !$this->isNan() && is_infinite($this->mag);
    }

    public function isZero(): bool
    {
        return $this->sign === 0 && !$this->isNan();
    }

    // --- Comparisons ---

    public function eq(self $other): bool
    {
        return $this->sign === $other->sign
            && $this->layer === $other->layer
            && $this->mag === $other->mag;
    }

    public function cmp(self $other): int
    {
        if ($this->sign > $other->sign) {
            return 1;
        }
        if ($this->sign < $other->sign) {
            return -1;
        }

        return $this->sign * $this->cmpabs($other);
    }

    public function cmpabs(self $other): int
    {
        $layera = $this->mag > 0 ? $this->layer : -$this->layer;
        $layerb = $other->mag > 0 ? $other->layer : -$other->layer;

        if ($layera > $layerb) {
            return 1;
        }
        if ($layera < $layerb) {
            return -1;
        }
        if ($this->mag > $other->mag) {
            return 1;
        }
        if ($this->mag < $other->mag) {
            return -1;
        }

        return 0;
    }

    public function lt(self $other): bool
    {
        return $this->cmp($other) === -1;
    }

    public function lte(self $other): bool
    {
        return $this->cmp($other) <= 0;
    }

    public function gt(self $other): bool
    {
        return $this->cmp($other) === 1;
    }

    public function gte(self $other): bool
    {
        return $this->cmp($other) >= 0;
    }

    // --- Arithmetic ---

    public function neg(): self
    {
        return new self(-$this->sign, $this->layer, $this->mag);
    }

    public function abs(): self
    {
        return new self($this->sign === 0 ? 0 : 1, $this->layer, $this->mag);
    }

    public function add(self $other): self
    {
        // inf + -inf = NaN
        if ($this->isInfinite() && $other->isInfinite() && $this->sign !== $other->sign) {
            return new self(0, 0, NAN);
        }
        if (!is_finite($this->layer)) {
            return $this;
        }
        if (!is_finite($other->layer)) {
            return $other;
        }
        if ($this->sign === 0) {
            return $other;
        }
        if ($other->sign === 0) {
            return $this;
        }
        if ($this->sign === -$other->sign && $this->layer === $other->layer && $this->mag === $other->mag) {
            return self::zero();
        }

        if ($this->layer >= 2 || $other->layer >= 2) {
            return $this->maxabs($other);
        }

        if (self::staticCmpabs($this, $other) > 0) {
            $a = $this;
            $b = $other;
        } else {
            $a = $other;
            $b = $this;
        }

        if ($a->layer === 0 && $b->layer === 0) {
            return self::fromNumber($a->sign * $a->mag + $b->sign * $b->mag);
        }

        $layera = $a->layer * ($a->mag >= 0 ? 1 : -1);
        $layerb = $b->layer * ($b->mag >= 0 ? 1 : -1);

        if ($layera - $layerb >= 2) {
            return $a;
        }

        if ($layera === 0 && $layerb === -1) {
            if (abs($b->mag - V8Math::log10($a->mag)) > self::MAX_SIGNIFICANT_DIGITS) {
                return $a;
            }
            $magdiff = V8Math::pow10(V8Math::log10($a->mag) - $b->mag);
            $mantissa = $b->sign + $a->sign * $magdiff;
            $newSign = $mantissa >= 0 ? 1 : ($mantissa < 0 ? -1 : 0);

            return self::fromComponents(
                $newSign,
                1,
                $b->mag + V8Math::log10(abs($mantissa)),
            );
        }

        if ($layera === 1 && $layerb === 0) {
            if (abs($a->mag - V8Math::log10($b->mag)) > self::MAX_SIGNIFICANT_DIGITS) {
                return $a;
            }
            $magdiff = V8Math::pow10($a->mag - V8Math::log10($b->mag));
            $mantissa = $b->sign + $a->sign * $magdiff;
            $newSign = $mantissa >= 0 ? 1 : ($mantissa < 0 ? -1 : 0);

            return self::fromComponents(
                $newSign,
                1,
                V8Math::log10($b->mag) + V8Math::log10(abs($mantissa)),
            );
        }

        // Both layer 1
        if (abs($a->mag - $b->mag) > self::MAX_SIGNIFICANT_DIGITS) {
            return $a;
        }
        $magdiff = V8Math::pow10($a->mag - $b->mag);
        $mantissa = $b->sign + $a->sign * $magdiff;
        $newSign = $mantissa >= 0 ? 1 : ($mantissa < 0 ? -1 : 0);

        return self::fromComponents(
            $newSign,
            1,
            $b->mag + V8Math::log10(abs($mantissa)),
        );
    }

    public function sub(self $other): self
    {
        return $this->add($other->neg());
    }

    public function mul(self $other): self
    {
        if ($this->isInfinite() && $other->isInfinite()) {
            if ($this->sign !== $other->sign) {
                return new self(-1, PHP_INT_MAX, INF);
            }

            return new self(1, PHP_INT_MAX, INF);
        }
        if (!is_finite($this->layer)) {
            return $this;
        }
        if (!is_finite($other->layer)) {
            return $other;
        }
        if ($this->sign === 0 || $other->sign === 0) {
            return self::zero();
        }
        if ($this->layer === $other->layer && $this->mag === -$other->mag) {
            return new self($this->sign * $other->sign, 0, 1);
        }

        if ($this->layer > $other->layer
            || ($this->layer === $other->layer && abs($this->mag) > abs($other->mag))) {
            $a = $this;
            $b = $other;
        } else {
            $a = $other;
            $b = $this;
        }

        if ($a->layer === 0 && $b->layer === 0) {
            return self::fromNumber($a->sign * $b->sign * $a->mag * $b->mag);
        }

        if ($a->layer >= 3 || $a->layer - $b->layer >= 2) {
            return new self($a->sign * $b->sign, $a->layer, $a->mag);
        }

        if ($a->layer === 1 && $b->layer === 0) {
            return self::fromComponents(
                $a->sign * $b->sign,
                1,
                $a->mag + V8Math::log10($b->mag),
            );
        }

        if ($a->layer === 1 && $b->layer === 1) {
            return self::fromComponents(
                $a->sign * $b->sign,
                1,
                $a->mag + $b->mag,
            );
        }

        if ($a->layer === 2 && $b->layer === 1) {
            $newmag = self::fromComponents(
                $a->mag >= 0 ? 1 : -1,
                $a->layer - 1,
                abs($a->mag),
            )->add(self::fromComponents(
                $b->mag >= 0 ? 1 : -1,
                $b->layer - 1,
                abs($b->mag),
            ));

            return self::fromComponents(
                $a->sign * $b->sign,
                $newmag->layer + 1,
                $newmag->sign * $newmag->mag,
            );
        }

        if ($a->layer === 2 && $b->layer === 2) {
            $newmag = self::fromComponents(
                $a->mag >= 0 ? 1 : -1,
                $a->layer - 1,
                abs($a->mag),
            )->add(self::fromComponents(
                $b->mag >= 0 ? 1 : -1,
                $b->layer - 1,
                abs($b->mag),
            ));

            return self::fromComponents(
                $a->sign * $b->sign,
                $newmag->layer + 1,
                $newmag->sign * $newmag->mag,
            );
        }

        return new self(0, 0, NAN);
    }

    public function recip(): self
    {
        if ($this->mag === 0.0) {
            return new self(0, 0, NAN);
        }
        if ($this->isInfinite()) {
            return self::zero();
        }
        if ($this->layer === 0) {
            return self::fromComponents($this->sign, 0, 1.0 / $this->mag);
        }

        return self::fromComponents($this->sign, $this->layer, -$this->mag);
    }

    public function div(self $other): self
    {
        return $this->mul($other->recip());
    }

    public function floor(): self
    {
        if ($this->isNan()) {
            return $this;
        }
        if ($this->mag < 0) {
            if ($this->sign === -1) {
                return new self(-1, 0, 1);
            }

            return self::zero();
        }
        if ($this->sign === -1) {
            return $this->neg()->ceil()->neg();
        }
        if ($this->layer === 0) {
            return self::fromComponents($this->sign, 0, floor($this->mag));
        }

        return $this;
    }

    public function ceil(): self
    {
        if ($this->isNan()) {
            return $this;
        }
        if ($this->mag < 0) {
            if ($this->sign === 1) {
                return new self(1, 0, 1);
            }

            return self::zero();
        }
        if ($this->sign === -1) {
            return $this->neg()->floor()->neg();
        }
        if ($this->layer === 0) {
            return self::fromComponents($this->sign, 0, ceil($this->mag));
        }

        return $this;
    }

    /**
     * Base-10 logarithm of abs(this).
     */
    public function absLog10(): self
    {
        if ($this->sign === 0) {
            return new self(0, 0, NAN);
        }
        if ($this->layer > 0) {
            return new self(
                $this->mag >= 0 ? 1 : -1,
                $this->layer - 1,
                abs($this->mag),
            );
        }

        return self::fromComponents(1, 0, V8Math::log10($this->mag));
    }

    public function log10(): self
    {
        if ($this->sign <= 0) {
            return new self(0, 0, NAN);
        }
        if ($this->layer > 0) {
            return self::fromComponents(
                $this->mag >= 0 ? 1 : -1,
                $this->layer - 1,
                abs($this->mag),
            );
        }

        return self::fromComponents($this->sign, 0, V8Math::log10($this->mag));
    }

    /**
     * 10^this.
     */
    public function pow10(): self
    {
        if ($this->isInfinite()) {
            return $this->sign === 1
                ? new self(1, PHP_INT_MAX, INF)
                : self::zero();
        }
        if ($this->isNan()) {
            return $this;
        }

        if ($this->layer === 0) {
            $newmag = V8Math::pow10($this->sign * $this->mag);
            if (is_finite($newmag) && abs($newmag) >= 0.1) {
                return new self(1, 0, $newmag);
            }
            if ($this->sign === 0) {
                return self::one();
            }
            // Promote
            $promoted = self::normalize(
                $this->sign,
                $this->layer + 1,
                V8Math::log10($this->mag),
            );

            return self::pow10Helper($promoted);
        }

        return self::pow10Helper($this);
    }

    private static function pow10Helper(self $a): self
    {
        if ($a->sign > 0 && $a->mag >= 0) {
            return new self($a->sign, $a->layer + 1, $a->mag);
        }
        if ($a->sign < 0 && $a->mag >= 0) {
            return new self(-$a->sign, $a->layer + 1, -$a->mag);
        }

        return self::one();
    }

    /**
     * this^value.
     */
    public function powDecimal(self $other): self
    {
        if ($this->sign === 0) {
            return $other->eq(self::zero()) ? self::one() : $this;
        }
        if ($this->sign === 1 && $this->layer === 0 && $this->mag === 1.0) {
            return $this;
        }
        if ($other->sign === 0) {
            return self::one();
        }
        if ($other->sign === 1 && $other->layer === 0 && $other->mag === 1.0) {
            return $this;
        }

        $result = $this->absLog10()->mul($other)->pow10();

        if ($this->sign === -1) {
            $mod = fmod(abs($other->toNumber()), 2);
            if (fmod($mod, 2) === 1.0) {
                return $result->neg();
            }
            if (fmod($mod, 2) === 0.0) {
                return $result;
            }

            return new self(0, 0, NAN);
        }

        return $result;
    }

    public function max(self $other): self
    {
        return $this->lt($other) ? $other : $this;
    }

    public function min(self $other): self
    {
        return $this->gt($other) ? $other : $this;
    }

    public function maxabs(self $other): self
    {
        return $this->cmpabs($other) < 0 ? $other : $this;
    }

    private static function staticCmpabs(self $a, self $b): int
    {
        return $a->cmpabs($b);
    }
}
