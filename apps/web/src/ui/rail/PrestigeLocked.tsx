import type { ReactNode } from 'react';
import type { PrestigeCopy } from '@dm/content';
import { Panel } from '../Panel.tsx';
import './PrestigeLocked.css';

interface PrestigeLockedProps {
  copy: PrestigeCopy;
}

/**
 * The slot the reset will fill, held open before it can be taken.
 *
 * A placeholder in place, sized to what lands — the rule the rest of the interface keeps
 * everywhere. Without it the panel arrives from nowhere and shoves the deck up the page
 * once a session, which is the one thing a screen is not allowed to do.
 *
 * It names what to go and do rather than what is missing. "Inflict further suffering"
 * is a direction; "souls locked" is a complaint.
 *
 * Nothing here is pressable. A disabled control would say the reset is a thing you
 * nearly have, and it is not — it is a thing you have not earned.
 */
export function PrestigeLocked({ copy }: PrestigeLockedProps): ReactNode {
  return (
    <Panel title={copy.name} glyph="✧">
      <p className="prestige-locked__line">{copy.locked}</p>
    </Panel>
  );
}
