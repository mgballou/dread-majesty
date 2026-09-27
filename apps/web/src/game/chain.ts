import { isContent } from '@dm/content';
import type { Content } from '@dm/content';

/**
 * Where the published chain lives, or null to run on the bundled one.
 *
 * Set at build time through `VITE_CHAIN_URL`. Unset is the default and the game
 * behaves exactly as it did before a chain could be fetched.
 */
export const CHAIN_URL: string | null = import.meta.env.VITE_CHAIN_URL || null;

/** Longer than this and the player is looking at a boot screen for a balance patch. */
export const CHAIN_TIMEOUT_MS = 3000;

/**
 * The chain to play: the fetched one if it is valid and newer, the bundled one otherwise.
 *
 * Never rejects. A network error, a timeout, a non-2xx, a body that is not JSON, a
 * chain that fails `isContent` and a chain no newer than `bundled` all come back as
 * `bundled`. The game works with no network, permanently (plan §7), so a failure here
 * is not worth telling the player about.
 */
export async function fetchChain({
  url,
  bundled,
  timeoutMs = CHAIN_TIMEOUT_MS,
}: {
  url: string;
  bundled: Content;
  timeoutMs?: number;
}): Promise<Content> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: abort.signal });
    if (!response.ok) return bundled;
    const fetched: unknown = await response.json();
    return isContent(fetched) && isNewerVersion(fetched.version, bundled.version)
      ? fetched
      : bundled;
  } catch {
    return bundled;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compares dotted numeric versions, so `1.10` is newer than `1.9` and `2` than `1.4`.
 *
 * A leading `v` is allowed because release tags carry one. Anything else that is not
 * a number is never newer: an unreadable version cannot displace a readable one.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = versionParts(candidate);
  const b = versionParts(current);
  if (a === null || b === null) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
}

function versionParts(version: string): number[] | null {
  const match = /^v?(\d+(?:\.\d+)*)$/.exec(version);
  return match?.[1] ? match[1].split('.').map(Number) : null;
}
