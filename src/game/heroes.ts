import { PICKUP } from './config';

export type HeroId = 'owen' | 'alice';
export type AirAbility = 'dash' | 'float';

export interface HeroDef {
  readonly id: HeroId;
  readonly name: string;
  readonly age: number;
  readonly sidekickName: string;
  readonly sidekickKind: 'car' | 'unicorn';
  readonly airAbility: AirAbility;
  readonly pickupRadius: number;
  /** What a popped cloud bursts into. */
  readonly popBurst: 'raindrops' | 'flowers';
  /** Tip strip text for the air ability. */
  readonly airTip: string;
  /** Title-screen button label. */
  readonly pickLabel: string;
}

export const HEROES: Readonly<Record<HeroId, HeroDef>> = {
  owen: {
    id: 'owen',
    name: 'Owen',
    age: 8,
    sidekickName: 'Jackson',
    sidekickKind: 'car',
    airAbility: 'dash',
    pickupRadius: PICKUP.owenRadius,
    popBurst: 'raindrops',
    airTip: 'Tap again in the air to dash.',
    pickLabel: 'Owen and Jackson',
  },
  alice: {
    id: 'alice',
    name: 'Alice',
    age: 5,
    sidekickName: 'Aliceson',
    sidekickKind: 'unicorn',
    airAbility: 'float',
    pickupRadius: PICKUP.radius,
    popBurst: 'flowers',
    airTip: 'Keep holding in the air to float down.',
    pickLabel: 'Alice and Aliceson',
  },
};

export const HERO_IDS: readonly HeroId[] = ['owen', 'alice'];

export function getHero(id: HeroId): HeroDef {
  return HEROES[id];
}
