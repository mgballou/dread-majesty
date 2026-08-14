import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ReactElement } from 'react';
import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState } from '@dm/engine';
import { describe, expect, it, vi } from 'vitest';
import { setReducedMotion } from '../../../test/setup.ts';
import { EvilNode } from './EvilNode.tsx';

function evil(overrides: Partial<Parameters<typeof EvilNode>[0]> = {}): ReactElement {
  return (
    <EvilNode
      total={new Decimal(4875)}
      name={CURRENT_COPY.evil.name}
      copy={CURRENT_COPY.smite}
      report=""
      phase={{ kind: 'ready', share: 0 }}
      content={CURRENT}
      state={createState(CURRENT)}
      feed={null}
      onSmite={vi.fn()}
      {...overrides}
    />
  );
}

function strike(): HTMLElement {
  return screen.getByRole('button', { name: /^Smite\./ });
}

describe('EvilNode', () => {
  it('shows the total through the shared formatter', () => {
    render(evil());

    expect(screen.getByText('4.88K')).toBeInTheDocument();
  });

  it('makes the total itself the control', () => {
    render(evil());

    expect(strike()).toHaveTextContent('4.88K');
  });

  it('speaks the figure as well as the verb', () => {
    render(evil());

    expect(strike()).toHaveAccessibleName('Smite. You hold 4.88K Evil. The realm flinches.');
  });

  it('speaks the middle band half way up the cap', () => {
    const state = createState(CURRENT);
    state.smiteApathy = CURRENT.smite.apathy.cap / 2;
    render(evil({ state }));

    expect(strike()).toHaveAccessibleName('Smite. You hold 4.88K Evil. The realm has seen worse.');
  });

  it('speaks the highest band once apathy reaches the cap', () => {
    const state = createState(CURRENT);
    state.smiteApathy = CURRENT.smite.apathy.cap;
    render(evil({ state }));

    expect(strike()).toHaveAccessibleName(
      'Smite. You hold 4.88K Evil. The realm has stopped looking.',
    );
  });

  it('names the verb in words, not by colour alone', () => {
    render(evil());

    expect(screen.getByText(CURRENT_COPY.smite.action)).toBeInTheDocument();
  });

  it('reports the blow to its caller', async () => {
    const onSmite = vi.fn();
    render(evil({ onSmite }));

    await userEvent.click(strike());

    expect(onSmite).toHaveBeenCalledOnce();
  });

  it('is lifted whenever the blow is ready', () => {
    const { container } = render(evil({ phase: { kind: 'ready', share: 0 } }));

    expect(container.querySelector('.evil-node__strike--lifted')).not.toBeNull();
  });

  it('is not lifted while it is cooling', () => {
    const { container } = render(evil({ phase: { kind: 'cooling', share: 0.4 } }));

    expect(container.querySelector('.evil-node__strike--lifted')).toBeNull();
  });

  it('is not lifted while it is running', () => {
    const { container } = render(evil({ phase: { kind: 'active', share: 0.2 } }));

    expect(container.querySelector('.evil-node__strike--lifted')).toBeNull();
  });

  it('holds the report line open before any blow has been struck', () => {
    const { container } = render(evil());

    expect(container.querySelector('.evil-node__report')).toBeEmptyDOMElement();
  });

  it('says what the last blow came to', () => {
    render(evil({ report: 'An orchard, salted.' }));

    expect(screen.getByText('An orchard, salted.')).toBeInTheDocument();
  });

  it('says the verb while it is ready', () => {
    render(evil());

    expect(screen.getByText(CURRENT_COPY.smite.action)).toBeInTheDocument();
  });

  it('says what the running blow is worth', () => {
    const state = createState(CURRENT);
    state.smiteBlow = 1.75;
    render(evil({ phase: { kind: 'active', share: 0.5 }, state }));

    expect(screen.getByText('×1.75')).toBeInTheDocument();
  });

  it('holds the struck blow rather than what a fresh one would be worth', () => {
    const state = createState(CURRENT);
    state.smiteBlow = 1.5;
    state.smiteRungs.weight = 4;
    render(evil({ phase: { kind: 'active', share: 0.5 }, state }));

    expect(screen.getByText('×1.50')).toBeInTheDocument();
  });

  it('says it is coming while it is spent', () => {
    render(evil({ phase: { kind: 'cooling', share: 0.5 } }));

    expect(screen.getByText(CURRENT_COPY.smite.cooling)).toBeInTheDocument();
  });

  it('puts no countdown on the control while it is spent', () => {
    render(evil({ phase: { kind: 'cooling', share: 0.5 } }));

    expect(strike().textContent).not.toMatch(/\ds/);
  });

  it('refuses to be struck while cooling', () => {
    render(evil({ phase: { kind: 'cooling', share: 0.5 } }));

    expect(strike()).toBeDisabled();
  });

  it('marks which part of the blow it is in, for the stylesheet', () => {
    const { container } = render(evil({ phase: { kind: 'active', share: 1 } }));

    expect(container.querySelector('.evil-node')).toHaveAttribute('data-smite', 'active');
  });

  it('marks the reduced-motion branch on the node', () => {
    setReducedMotion(true);
    const { container } = render(evil());

    expect(container.querySelector('.evil-node')).toHaveAttribute('data-motion', 'reduced');
  });

  it('carries no beckon marker by default', () => {
    const { container } = render(evil());

    expect(container.querySelector('.evil-node')).toHaveAttribute('data-beckon', 'false');
  });

  it('marks the beckon on the node when told to draw the eye', () => {
    const { container } = render(evil({ beckon: true }));

    expect(container.querySelector('.evil-node')).toHaveAttribute('data-beckon', 'true');
  });
});

/**
 * Walks up from the working directory rather than reading `import.meta.url`, which
 * under jsdom is an http URL and cannot be turned into a path. Mirrors `tokens.test.ts`.
 */
function locate(relative: string): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, relative))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Could not find ${relative} above ${process.cwd()}`);
    dir = parent;
  }
  return join(dir, relative);
}

const css = readFileSync(locate(join('apps', 'web', 'src', 'ui', 'stage', 'EvilNode.css')), 'utf8');

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The declaration body of a single CSS rule, found by its selector text. */
function rule(selector: string): string {
  const pattern = new RegExp(`${escapeForPattern(selector)}\\s*\\{([^}]*)\\}`);
  const match = pattern.exec(css);
  if (!match) throw new Error(`No rule found in EvilNode.css for selector "${selector}"`);
  return match[1] ?? '';
}

/**
 * The beckon is emphasis on a control that is already visible, labeled and reachable, so
 * reduced motion has to be able to drop it and put nothing in its place — unlike the
 * landing pulse above it, which carries information and so has a reduced-motion face of
 * its own.
 */
describe('the stylesheet contract', () => {
  it('animates the beckon only under full motion', () => {
    expect(
      rule(
        ".evil-node[data-motion='full'][data-beckon='true'][data-smite='ready'] .evil-node__strike",
      ),
    ).toMatch(/animation/);
  });

  it('leaves the strike unanimated outside that gated rule', () => {
    expect(rule('.evil-node__strike')).not.toMatch(/animation/);
  });
});
