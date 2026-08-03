import type { ReactNode } from 'react';
import { Banner } from './Banner.tsx';
import './Panel.css';

interface PanelProps {
  title: string;
  /** Decorative mark set at the leading edge. Hidden from assistive tech. */
  glyph?: string;
  /** Count or state, set to the trailing edge. */
  trailing?: ReactNode;
  /** Controls belonging to the region, never the screen's primary action. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The titled region, built once.
 *
 * A heading earns its weight from structure, not from size (ui-sensibility §6). The
 * band owns a raised surface with a rule beneath it; the body sits inset and one
 * step back, so heading and content read as one built unit. Four slots cover every
 * titled region in the game — title, glyph, trailing count, actions. A fifth would
 * be a smell.
 *
 * The title itself is a `Banner`, so a panel head and a heading laid by hand cannot
 * drift apart. The glyph rides inside the banner rather than beside it.
 */
export function Panel({ title, glyph, trailing, actions, children }: PanelProps): ReactNode {
  return (
    <section className="panel">
      <div className="panel__band">
        <Banner
          as="h2"
          weight="primary"
          className="panel__title"
          {...(glyph === undefined ? {} : { glyph })}
        >
          {title}
        </Banner>
        {trailing !== undefined && <span className="panel__trailing">{trailing}</span>}
        {actions !== undefined && <div className="panel__actions">{actions}</div>}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}
