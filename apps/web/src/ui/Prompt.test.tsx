import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Prompt } from './Prompt.tsx';

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

const css = readFileSync(locate(join('apps', 'web', 'src', 'ui', 'Prompt.css')), 'utf8');

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The declaration body of a single CSS rule, found by its selector text. */
function rule(selector: string): string {
  const pattern = new RegExp(`${escapeForPattern(selector)}\\s*\\{([^}]*)\\}`);
  const match = pattern.exec(css);
  if (!match) throw new Error(`No rule found in Prompt.css for selector "${selector}"`);
  return match[1] ?? '';
}

describe('Prompt', () => {
  it('shows the line it is given', () => {
    render(<Prompt line="Set it about some wickedness." voice="narrator" label="Advice" />);
    expect(screen.getByText('Set it about some wickedness.')).toBeInTheDocument();
  });

  it('names itself to a screen reader', () => {
    render(<Prompt line="A line." voice="narrator" label="Advice" />);
    expect(screen.getByRole('status', { name: 'Advice' })).toBeInTheDocument();
  });

  it('marks her voice on the element', () => {
    render(<Prompt line="Do it again." voice="her" label="She speaks" />);
    expect(screen.getByRole('status')).toHaveClass('prompt--her');
  });

  it('offers no bail actions by default', () => {
    render(<Prompt line="A line." voice="narrator" label="Advice" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onSkip when the player skips', async () => {
    const onSkip = vi.fn();
    render(
      <Prompt
        line="A line."
        voice="narrator"
        label="Advice"
        bail={{ skip: 'Skip tutorial', loadSave: 'Load save', onSkip, onLoadSave: vi.fn() }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('calls onLoadSave when the player has one to load', async () => {
    const onLoadSave = vi.fn();
    render(
      <Prompt
        line="A line."
        voice="narrator"
        label="Advice"
        bail={{ skip: 'Skip tutorial', loadSave: 'Load save', onSkip: vi.fn(), onLoadSave }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Load save' }));
    expect(onLoadSave).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when closed by hand', async () => {
    const onDismiss = vi.fn();
    render(
      <Prompt
        line="A line."
        voice="narrator"
        label="Advice"
        dismiss={{ label: 'Understood', onDismiss }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Understood' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

/**
 * The narrator/her distinction has to survive on paper too: a screen reader gets it from
 * `aria-label` (varied by the caller per beat, tested above), never from these rules. What
 * these rules owe is the visual signal for anyone who cannot rely on hue. Delete the marker
 * or the italic and every test above still passes, so the stylesheet needs its own contract.
 */
describe('the voices stay visually distinct from each other', () => {
  it('gives the narrator a marker with real content', () => {
    const before = rule('.prompt--narrator .prompt__line::before');
    const content = /content:\s*(['"])(.*?)\1/.exec(before)?.[2] ?? '';
    expect(content.length).toBeGreaterThan(0);
  });

  it('sets her voice in italic', () => {
    expect(rule('.prompt--her .prompt__line')).toMatch(/font-style:\s*italic/);
  });

  it('ties her voice to --tone-malice', () => {
    const her = rule('.prompt--her') + rule('.prompt--her .prompt__line');
    expect(her).toMatch(/--tone-malice/);
  });

  it('keeps neither voice at the full-strength accent', () => {
    const both = [
      rule('.prompt--narrator .prompt__line'),
      rule('.prompt--narrator .prompt__line::before'),
      rule('.prompt--her'),
      rule('.prompt--her .prompt__line'),
    ].join('\n');

    expect(both).not.toMatch(/--accent(?!-)/);
  });
});

/**
 * Playtest read the bar as furniture, and the 2026-08-14 spec §3.4 answers with larger
 * type, a heavier ground and more room. Nothing above can see any of that — the words,
 * the voices and the buttons are all identical at either weight — so a revert of that
 * step would be silent without these three.
 */
describe('the bar reads as a thing being said', () => {
  it('sets the line above the reading size', () => {
    expect(rule('.prompt__line')).toMatch(/font-size:\s*var\(--text-lg\)/);
  });

  it('stands on a heavier ground than the strip it sits on', () => {
    expect(rule('.prompt')).toMatch(/background:\s*var\(--surface-panel\)/);
  });

  it('gives the line room on every side', () => {
    expect(rule('.prompt')).toMatch(/padding:\s*var\(--space-4\)/);
  });
});
