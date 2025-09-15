// #KGNINJA
export type Action = 'MOVE' | 'TURN_LEFT' | 'TURN_RIGHT' | 'FIRE' | 'WAIT';

export enum Direction { Up = 0, Right = 1, Down = 2, Left = 3 }

export type Tile = 'empty' | 'wall';

export interface Tank {
  id: number;
  x: number;
  y: number;
  dir: Direction;
  hp: number;
  cooldown: number; // ticks until can fire again
  lastScan?: number | null; // optional, reserved
}

export interface Bullet {
  x: number;
  y: number;
  dir: Direction;
}

export interface GameState {
  width: number;
  height: number;
  grid: Tile[][];
  tanks: Tank[]; // index by id (0,1)
  bullets: Bullet[];
  tick: number;
  status: 'playing' | 'gameover';
  winner: number | null;
}

export interface TankSense {
  enemyAhead: boolean;
  wallAhead: boolean;
}

export interface TankView {
  id: number;
  x: number;
  y: number;
  dir: Direction;
  hp: number;
  tick: number;
  sense: TankSense;
}

export interface AIRule { if: string; do: Action }
export interface AIProgram { name?: string; rules: AIRule[] }
export type AIController = (view: TankView, rnd: () => number) => Action;

export interface RNG { seed: number; next(): number; }

