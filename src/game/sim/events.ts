/** Things that happened during one simulation step. The renderer and audio react to these. */
export type SimEvent =
  | { type: 'jump' }
  | { type: 'land'; surface: 'ground' | 'platform' | 'cloud' }
  | { type: 'dash' }
  | { type: 'floatStart' }
  | { type: 'star'; id: number; streak: number }
  | { type: 'shard'; id: number }
  | { type: 'stomp'; cloudId: number }
  | { type: 'pop'; cloudId: number }
  | { type: 'bump'; cloudId: number }
  | { type: 'pitBounce' }
  | { type: 'respawn'; checkpointId: number }
  | { type: 'checkpoint'; id: number }
  | { type: 'finish' };
