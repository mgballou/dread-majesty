import { describe, expect, it } from 'vitest';
import { verify } from './verify.ts';

describe('conformance vectors', () => {
  it('all vectors pass verification', () => {
    const result = verify();
    if (result.failures.length > 0) {
      const details = result.failures
        .map((f) => `${f.label}:\n${f.errors.map((e) => `  ${e}`).join('\n')}`)
        .join('\n\n');
      expect.fail(`${result.failures.length} vectors failed:\n\n${details}`);
    }
    expect(result.passed).toBe(result.total);
  });
});
