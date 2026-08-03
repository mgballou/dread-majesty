import type { ReactNode } from 'react';
import type { AchievementDef, Content, Copy } from '@dm/content';
import type { GameState } from '@dm/engine';
import './Trophies.css';

interface TrophiesProps {
  state: GameState;
  content: Content;
  copy: Copy['deeds'];
}

/**
 * The record of deeds.
 *
 * Every achievement is shown, earned or not, because a wall of locked slots is the
 * point — it names what is still ahead. An unearned one shows its name and what it
 * asks for; it is not a mystery box, since a goal nobody can read drives nothing.
 *
 * State carries its own tone here: earned or not is the only distinction, and it is
 * carried by a word and a mark as well as by weight, never by colour alone.
 *
 * It draws no title and no count of its own. It is one panel of the deck now, and the
 * tab that opened it is the heading — a second plaque under the first would be a
 * heading competing with the structure that already gave it its weight (§6).
 */
export function Trophies({ state, content, copy }: TrophiesProps): ReactNode {
  const earned = new Set(state.earnedAchievements);

  return (
    <div className="deeds">
      <p className="deeds__what">{copy.what}</p>

      <ul className="trophies">
        {content.achievements.map((achievement) => (
          <Trophy
            key={achievement.id}
            achievement={achievement}
            earned={earned.has(achievement.id)}
            unearnedLabel={copy.unearned}
          />
        ))}
      </ul>
    </div>
  );
}

interface TrophyProps {
  achievement: AchievementDef;
  earned: boolean;
  unearnedLabel: string;
}

function Trophy({ achievement, earned, unearnedLabel }: TrophyProps): ReactNode {
  return (
    <li className={earned ? 'trophy trophy--earned' : 'trophy'}>
      <span className="trophy__mark" aria-hidden="true">
        {earned ? '✦' : '·'}
      </span>
      <span className="trophy__body">
        <span className="trophy__name">{achievement.name}</span>
        <span className="trophy__note">{achievement.description}</span>
      </span>
      <span className="trophy__state">{earned ? 'Done' : unearnedLabel}</span>
    </li>
  );
}
