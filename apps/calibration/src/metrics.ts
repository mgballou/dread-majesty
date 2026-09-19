export interface ScoredPrediction {
  readonly p: number;
  readonly outcome: 0 | 1;
}

export interface ReliabilityBin {
  readonly bucket: number;
  readonly count: number;
  readonly stated: number;
  readonly observed: number;
}

export function brierScore(predictions: readonly ScoredPrediction[]): number {
  if (predictions.length === 0) return 0;
  return predictions.reduce((total, prediction) => total + (prediction.p - prediction.outcome) ** 2, 0) / predictions.length;
}

export function reliabilityCurve(predictions: readonly ScoredPrediction[], bucketCount = 5): ReliabilityBin[] {
  const buckets = Array.from({ length: bucketCount }, (_, bucket) => ({ bucket, predictions: [] as ScoredPrediction[] }));
  for (const prediction of predictions) {
    const bucket = Math.min(bucketCount - 1, Math.floor(prediction.p * bucketCount));
    const target = buckets[bucket];
    if (target) target.predictions.push(prediction);
  }
  return buckets
    .filter(({ predictions }) => predictions.length > 0)
    .map(({ bucket, predictions }) => ({
      bucket,
      count: predictions.length,
      stated: mean(predictions.map(({ p }) => p)),
      observed: mean(predictions.map(({ outcome }) => outcome)),
    }));
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
