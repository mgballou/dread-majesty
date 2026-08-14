import type { ReactElement, ReactNode } from 'react';
import { ART, type ArtSlot } from '@dm/content';
import './TierArt.css';

interface TierArtProps {
  /** Key into the art manifest, e.g. `tier/warren`. */
  slot: string;
  /**
   * Drawn size in pixels, or omitted to fill whatever box the caller put it in.
   *
   * Filling is what the chain wants: its medallion shrinks with the viewport, and a
   * fixed pixel size hung inside a shrinking box is exactly how the art ends up
   * spilling out of its ring on a phone.
   */
  size?: number;
  /** True where a neighbouring label already names the thing. */
  decorative?: boolean;
}

/**
 * A tier's picture, from the manifest, with a drawn fallback when no file exists.
 *
 * Every slot renders something, so the game looks finished with zero image files
 * and the build never depends on the art lab being reachable. Filling a slot later
 * is dropping a file into `public/art/` and setting `src` in the manifest — no
 * change here.
 *
 * The fallback is a silhouette in the slot's tone. Tone rides with the data: the
 * manifest names a semantic token and this component resolves it, so no screen
 * decides what colour a tier is.
 */
export function TierArt({ slot, size, decorative = false }: TierArtProps): ReactNode {
  const art = ART[slot];
  if (!art) return null;

  const label = decorative ? undefined : art.alt;
  const box =
    size === undefined ? { width: '100%', height: '100%' } : { width: size, height: size };
  // The tone is handed over as a custom property rather than as `color`, so a
  // stylesheet can take the drawing's colour over — which is exactly what the chain
  // does while a blow is running. An inline `color` would win and the silhouettes
  // would sit there in their own tones while everything around them burned.
  const style = { ...box, ['--art-tone' as string]: `var(--tone-${art.fallback.tone})` };

  if (art.src !== null) {
    return <img className="art" src={art.src} alt={decorative ? '' : art.alt} style={style} />;
  }

  return (
    <svg
      className="art"
      viewBox="0 0 48 48"
      style={style}
      role={decorative ? 'presentation' : 'img'}
      aria-label={label}
      aria-hidden={decorative || undefined}
    >
      {shape(art.fallback.shape)}
    </svg>
  );
}

/**
 * Straight-faced gothic, drawn flat. Silhouettes only — the tone carries the colour,
 * and a shape that reads at 24px reads at 96px too.
 *
 * Each one is built to be told apart from the others by its **outline alone**, at
 * rail size, before any of the detail inside it resolves. Two of the four are
 * buildings, so the silhouettes carry the distinction: the fortress is tall,
 * symmetrical and battlemented, with conical roofs and a spire; the warren is wide,
 * low and lopsided, a sawtooth of three gables and a leaning chimney. The legion is
 * the only diagonal thing on the stage and the only one with a notched flag. The
 * minion is the only rounded, organic one, and the only one carrying anything.
 *
 * The detail inside earns its place at stage size, where the drawing is 48px: arrow
 * loops, doorways, a lantern. Nothing in here is a second colour — the voids are the
 * ground showing through and the rest is `currentColor` at a handful of weights.
 *
 * The throne is the fifth and tallest rung, and reads apart from the fortress by the
 * same outline rule: it is the only shape with a void at its foot and a broken arch
 * over its head, and the only one narrower at the top than at the bottom — the
 * fortress's towers stand in a symmetrical cluster filling the frame, the throne is
 * one seat, alone.
 */
function shape(kind: ArtSlot['fallback']['shape']): ReactElement {
  switch (kind) {
    case 'spire':
      return (
        <g fill="currentColor">
          <rect x="2" y="36" width="44" height="10" opacity="0.5" />
          <g opacity="0.5">
            <rect x="2" y="32" width="5" height="5" />
            <rect x="10" y="32" width="5" height="5" />
            <rect x="33" y="32" width="5" height="5" />
            <rect x="41" y="32" width="5" height="5" />
          </g>
          <rect x="6" y="18" width="9" height="28" opacity="0.74" />
          <path d="M3.5 18 L10.5 7 L17.5 18 Z" opacity="0.74" />
          <rect x="33" y="18" width="9" height="28" opacity="0.74" />
          <path d="M30.5 18 L37.5 7 L44.5 18 Z" opacity="0.74" />
          <rect x="17" y="12" width="14" height="34" />
          <path d="M24 0 L16 13 L32 13 Z" />
          <path d="M21 46 L21 39 A3 3 0 0 1 27 39 L27 46 Z" className="art__void" />
          <rect x="22.5" y="18" width="3" height="7" className="art__void" />
          <rect x="9" y="24" width="3" height="5" className="art__void" />
          <rect x="36" y="24" width="3" height="5" className="art__void" />
        </g>
      );
    case 'banner':
      return (
        <g fill="currentColor">
          <g opacity="0.5">
            <path d="M7 8 L2 46 L4.6 46 L9.4 8 Z" />
            <path d="M8.2 0.5 L5.2 8.6 L11.2 8.6 Z" />
            <path d="M14 8 L10 46 L12.6 46 L16.4 8 Z" />
            <path d="M15.2 0.5 L12.2 8.6 L18.2 8.6 Z" />
            <path d="M34 8 L38 46 L35.4 46 L31.6 8 Z" />
            <path d="M32.8 0.5 L29.8 8.6 L35.8 8.6 Z" />
            <path d="M41 8 L46 46 L43.4 46 L38.6 8 Z" />
            <path d="M39.8 0.5 L36.8 8.6 L42.8 8.6 Z" />
          </g>
          <path d="M22.5 9 L13 11.5 L13 20.5 L22.5 18 Z" opacity="0.45" />
          <rect x="22.5" y="4" width="3" height="42" />
          <path d="M24 0 L26.8 3.6 L24 7.2 L21.2 3.6 Z" />
          <path d="M25.5 8 L44 11 L38.5 20 L44 29 L25.5 32 Z" opacity="0.9" />
          <path
            d="M29.5 14.5 L33 14.5 L37 21 L33 27.5 L29.5 27.5 L33.5 21 Z"
            className="art__void"
          />
        </g>
      );
    case 'hovel':
      return (
        <g fill="currentColor">
          <path d="M33 31 L40 23.5 L47 31 L47 46 L33 46 Z" opacity="0.55" />
          <path d="M19 34 L27.5 25.5 L36 34 L36 46 L19 46 Z" opacity="0.75" />
          <path d="M14.5 22.5 L14.5 13 L18.5 13 L18.5 26 Z" opacity="0.9" />
          <path d="M1 29 L11.5 18 L22 29 L22 46 L1 46 Z" />
          <path d="M7.5 46 L7.5 37 A3.5 3.5 0 0 1 14.5 37 L14.5 46 Z" className="art__void" />
          <rect x="24.5" y="37" width="5" height="9" className="art__void" />
          <rect x="38.5" y="36" width="4" height="10" className="art__void" />
          <rect x="16" y="24.5" width="3" height="3" className="art__void" />
          <rect x="30.5" y="30" width="3" height="3" className="art__void" />
        </g>
      );
    case 'figure':
      return (
        <g fill="currentColor">
          <path d="M30 27 L41 31 L39.5 34.5 L28.5 30.5 Z" opacity="0.62" />
          <rect x="39.3" y="30" width="1.4" height="5" opacity="0.62" />
          <path d="M35.5 34.5 L44.5 34.5 L46 43 L34 43 Z" opacity="0.78" />
          <rect x="38" y="36.5" width="4" height="4" className="art__void" />
          <path d="M15.5 22 C8 28 5.5 36 6.5 46 L35.5 46 C36.5 36 33.5 27.5 30 22 Z" />
          <path d="M23 5 C30 7.5 33.5 14 32 23 L15.5 23 C14.5 14.5 17.5 7.5 23 5 Z" />
          <circle cx="20.5" cy="16.5" r="2" className="art__void" />
          <circle cx="27.5" cy="16.5" r="2" className="art__void" />
          <path d="M17 39.5 L29 39.5 L29 41.5 L17 41.5 Z" className="art__void" />
        </g>
      );
    case 'throne':
      return (
        <g fill="currentColor">
          <path
            d="M8.96 13.53 L10.43 10.52 L12.49 7.89 L15.05 5.74 L18.01 4.17 L21.77 3.16 L21.1 7.36 L18.74 8.21 L16.61 9.54 L14.81 11.29 L13.4 13.37 L12.72 14.9 Z"
            opacity="0.5"
          />
          <path
            d="M39.04 13.53 L37.57 10.52 L35.51 7.89 L32.95 5.74 L29.99 4.17 L26.23 3.16 L26.9 7.36 L29.26 8.21 L31.39 9.54 L33.19 11.29 L34.6 13.37 L35.28 14.9 Z"
            opacity="0.5"
          />
          <rect x="6" y="13" width="6" height="8" opacity="0.5" />
          <rect x="36" y="13" width="6" height="8" opacity="0.5" />
          <path d="M17 6 L31 6 L33 30 L15 30 Z" opacity="0.74" />
          <rect x="13" y="30" width="22" height="5" />
          <path d="M11 35 L37 35 L39 46 L9 46 Z" />
          <rect x="13" y="18" width="4" height="12" opacity="0.74" />
          <rect x="31" y="18" width="4" height="12" opacity="0.74" />
          <path d="M22 12 L24 8 L26 12 L24 16 Z" className="art__void" />
          <rect x="20" y="38" width="8" height="8" className="art__void" />
        </g>
      );
    case 'sigil':
      return (
        <>
          <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
            <circle cx="24" cy="24" r="17" />
            <path d="M12 16 L36 16 L24 38 Z" />
          </g>
          <g fill="currentColor">
            <circle cx="24" cy="23" r="3.4" />
            <path d="M24 0 L27.4 6 L20.6 6 Z" />
          </g>
        </>
      );
    case 'hammer':
      return (
        <g fill="currentColor">
          <rect x="9" y="7" width="30" height="13" />
          <rect x="5" y="10" width="4" height="7" opacity="0.5" />
          <rect x="39" y="10" width="4" height="7" opacity="0.5" />
          <rect x="21" y="20" width="6" height="22" opacity="0.74" />
          <rect x="18" y="42" width="12" height="4" />
          <rect x="22" y="10" width="4" height="7" className="art__void" />
        </g>
      );
  }
}
