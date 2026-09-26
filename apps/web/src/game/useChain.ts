import { useEffect, useState } from 'react';
import { CURRENT } from '@dm/content';
import type { Content } from '@dm/content';
import { fetchChain } from './chain.ts';

export interface Chain {
  content: Content;
  /** False only while a fetch is in flight. The session must not start before this. */
  settled: boolean;
}

/**
 * The content the game runs on, decided once at startup.
 *
 * With no URL the bundled `CURRENT` is settled on the first render, so an unset
 * `VITE_CHAIN_URL` changes nothing. With one, the answer is held until `fetchChain`
 * resolves — at most its timeout — because the save is read and caught up against
 * this content, and swapping it under a running session would price the catch-up in
 * one chain and the next purchase in another.
 */
export function useChain(url: string | null): Chain {
  const [chain, setChain] = useState<Chain>({ content: CURRENT, settled: url === null });

  useEffect(() => {
    if (url === null) return;
    void fetchChain({ url, bundled: CURRENT }).then((content) => {
      setChain({ content, settled: true });
    });
  }, [url]);

  return chain;
}
