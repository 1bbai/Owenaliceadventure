import { describe, expect, it } from 'vitest';
import { TRACKS, getTrack, jumpApexHeight, jumpDistanceFlat } from '../src/game/tracks';

describe('age tracks', () => {
  it('has the play-tested tuning numbers', () => {
    expect(TRACKS.map((t) => [t.runSpeed, t.gravity, t.jumpVelocity])).toEqual([
      [125, 1050, -470],
      [150, 1350, -520],
      [172, 1450, -540],
    ]);
    expect(getTrack(0).pits).toBe('bounce');
    expect(getTrack(0).clouds).toBe('harmless');
    expect(getTrack(1).pits).toBe('checkpoint');
    expect(getTrack(2).clouds).toBe('checkpoint');
  });

  it('uses sentence-case labels', () => {
    expect(TRACKS.map((t) => t.label)).toEqual(['Age 4 to 5', 'Age 6 to 7', 'Age 8 to 9']);
  });

  it('can jump onto the highest platform (125 units) with a full-hold jump on every track', () => {
    for (const t of TRACKS) {
      expect(jumpApexHeight(t)).toBeGreaterThan(55); // platform-to-platform climb
      expect(jumpApexHeight(t)).toBeGreaterThan(70); // ground to the low platforms
      expect(jumpDistanceFlat(t)).toBeGreaterThan(90); // widest pit
    }
  });
});
