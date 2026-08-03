import { render, screen } from '@testing-library/react';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState } from '@dm/engine';
import { describe, expect, it } from 'vitest';
import { Trophies } from './Trophies.tsx';

function seeded(earned: string[] = []) {
  const state = createState(CURRENT);
  state.earnedAchievements = CURRENT.achievements
    .filter((achievement) => earned.includes(achievement.id))
    .map((achievement) => achievement.id);
  return state;
}

describe('Trophies', () => {
  it('shows every deed, earned or not', () => {
    render(<Trophies state={seeded()} content={CURRENT} copy={CURRENT_COPY.deeds} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(CURRENT.achievements.length);
  });

  it('counts what has been earned against the whole', () => {
    render(<Trophies state={seeded()} content={CURRENT} copy={CURRENT_COPY.deeds} />);

    expect(
      screen.getByText(CURRENT_COPY.deeds.progress('0', String(CURRENT.achievements.length))),
    ).toBeInTheDocument();
  });

  it('says what an unearned deed asks for rather than hiding it', () => {
    const first = CURRENT.achievements[0];
    render(<Trophies state={seeded()} content={CURRENT} copy={CURRENT_COPY.deeds} />);

    expect(screen.getByText(first?.description ?? '')).toBeInTheDocument();
  });

  it('carries the earned state in a word, not only a tone', () => {
    const first = CURRENT.achievements[0];
    render(
      <Trophies state={seeded([first?.id ?? ''])} content={CURRENT} copy={CURRENT_COPY.deeds} />,
    );

    expect(screen.getAllByText('Done')).toHaveLength(1);
  });
});
