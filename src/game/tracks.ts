/**
 * Age tracks. Chosen by the player's age, not by the hero.
 * Units: logical units per second; y is negative upward.
 */
export type TrackId = 0 | 1 | 2;

export interface Track {
  readonly id: TrackId;
  /** Sentence-case label shown on the title screen. */
  readonly label: string;
  readonly runSpeed: number;
  readonly gravity: number;
  readonly jumpVelocity: number;
  /** What a pit does: bounce the hero back up, or return them to the last checkpoint. */
  readonly pits: 'bounce' | 'checkpoint';
  /** What bumping a cloud does: pop it harmlessly, or return the hero to the last checkpoint. */
  readonly clouds: 'harmless' | 'checkpoint';
}

export const TRACKS: readonly Track[] = [
  {
    id: 0,
    label: 'Age 4 to 5',
    runSpeed: 125,
    gravity: 1050,
    jumpVelocity: -470,
    pits: 'bounce',
    clouds: 'harmless',
  },
  {
    id: 1,
    label: 'Age 6 to 7',
    runSpeed: 150,
    gravity: 1350,
    jumpVelocity: -520,
    pits: 'checkpoint',
    clouds: 'checkpoint',
  },
  {
    id: 2,
    label: 'Age 8 to 9',
    runSpeed: 172,
    gravity: 1450,
    jumpVelocity: -540,
    pits: 'checkpoint',
    clouds: 'checkpoint',
  },
];

export function getTrack(id: TrackId): Track {
  const track = TRACKS[id];
  if (!track) throw new Error(`Unknown track ${id}`);
  return track;
}

/** Height of a full-hold jump, in units above the takeoff point. */
export function jumpApexHeight(track: Track): number {
  return (track.jumpVelocity * track.jumpVelocity) / (2 * track.gravity);
}

/** Horizontal distance covered by a full-hold jump that lands at takeoff height. */
export function jumpDistanceFlat(track: Track): number {
  const airtime = (2 * -track.jumpVelocity) / track.gravity;
  return airtime * track.runSpeed;
}
