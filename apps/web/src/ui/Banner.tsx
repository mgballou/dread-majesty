import type { ReactNode } from 'react';
import './Banner.css';

/** Heading levels only. A banner marks a heading; it never marks a paragraph. */
export type BannerLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

/** Rank on the screen. A panel title and a tier name are not the same thing. */
export type BannerWeight = 'primary' | 'secondary';

interface BannerProps {
  /**
   * The heading level this banner stands for. Required, and never guessed: the
   * banner has no idea what sits above it, so the caller owns document structure.
   */
  as: BannerLevel;
  weight: BannerWeight;
  /** Decorative mark set inside the leading edge. Hidden from assistive tech. */
  glyph?: string;
  /** Layout the caller owns — placement in a band, a row, a grid. Never colour. */
  className?: string;
  children: ReactNode;
}

/**
 * A gothic banner, chevron-tipped at the trailing edge, in gold.
 *
 * A heading earns its weight from structure, not from size (ui-sensibility §6). The
 * banner is that structure: gold line work carrying the title, so the rank is read
 * from the shape before a word of it is.
 *
 * The gold is deliberately **low weight** — an edge and a rule, never a fill. Full
 * strength gold belongs to its region's one action, and a banner is not an
 * action (§3, §5).
 *
 * Where `clip-path` is missing the chevron simply does not appear and the banner
 * falls back to a plain gold rule. A missing point costs nothing; a half-drawn one
 * would look broken.
 */
export function Banner({
  as: Heading,
  weight,
  glyph,
  className = '',
  children,
}: BannerProps): ReactNode {
  return (
    <Heading className={`banner banner--${weight}${className === '' ? '' : ` ${className}`}`}>
      <span className="banner__field">
        {glyph !== undefined && (
          <span className="banner__glyph" aria-hidden="true">
            {glyph}
          </span>
        )}
        <span className="banner__text">{children}</span>
      </span>
    </Heading>
  );
}
