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

  it('says what the panel is for', () => {
    render(<Trophies state={seeded()} content={CURRENT} copy={CURRENT_COPY.deeds} />);

    expect(screen.getByText(CURRENT_COPY.deeds.what)).toBeInTheDocument();
  });

  it('draws no title of its own, because the tab that opened it is the title', () => {
    render(<Trophies state={seeded()} content={CURRENT} copy={CURRENT_COPY.deeds} />);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
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
