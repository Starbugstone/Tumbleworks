import { expect, it } from 'vitest';
import { strikeEpisodes } from '../../src/world/pendulum-episodes';
import { PROPOSED_NUMERICS } from '../../src/world/pendulum-types';
import { recontactFixture } from './pendulum-recontact-fixture';

it('excludes post-impact trial nodes from the accepted free-episode gap receipt', () => {
  const fixture = recontactFixture();
  try {
    const incoming = 5.9718075582412755;
    const sequence = strikeEpisodes(fixture.core, incoming, incoming, .8, PROPOSED_NUMERICS);
    const freeEpisodes = sequence.episodes.filter(episode => episode.kind === 'free');
    expect(freeEpisodes.some(episode => episode.motion.exit === 'reimpact')).toBe(true);
    for (const episode of freeEpisodes) {
      expect(Number.isFinite(episode.motion.minimumGap)).toBe(true);
      expect(episode.motion.minimumGap).toBeGreaterThanOrEqual(0);
    }
  } finally {
    fixture.dispose();
  }
}, 120000);
