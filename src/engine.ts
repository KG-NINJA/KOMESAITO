// #KGNINJA
import { Action, AIController, Bullet, Direction, GameState, RNG, Tank, Tile, TankView } from './types.js';

export function makeRng(seed = 123456789): RNG {
  // Small LCG for deterministic runs
  let s = seed >>> 0;
  return {
    seed,
    next() {
      s = (1664525 * s + 1013904223) >>> 0;
      return (s & 0xffffffff) / 0x100000000;
    },
  };
}

export function dirVec(d: Direction): [number, number] {
  switch (d) {
    case Direction.Up: return [0, -1];
    case Direction.Right: return [1, 0];
    case Direction.Down: return [0, 1];
    case Direction.Left: return [-1, 0];
  }
}

export function rotLeft(d: Direction): Direction { return ((d + 3) & 3) as Direction; }
export function rotRight(d: Direction): Direction { return ((d + 1) & 3) as Direction; }

export function inBounds(st: GameState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < st.width && y < st.height;
}

export function tileAt(st: GameState, x: number, y: number): Tile | null {
  if (!inBounds(st, x, y)) return null;
  return st.grid[y][x];
}

export function tankAt(st: GameState, x: number, y: number): Tank | null {
  for (const t of st.tanks) if (t.hp > 0 && t.x === x && t.y === y) return t;
  return null;
}

export function makeMap(width = 16, height = 16): Tile[][] {
  const g: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      row.push(border ? 'wall' : 'empty');
    }
    g.push(row);
  }
  // A few fixed obstacles
  const walls: [number, number][] = [
    [5, 5], [5, 6], [5, 7],
    [10, 8], [10, 9], [10, 10],
    [8, 3], [9, 3],
  ];
  for (const [wx, wy] of walls) g[wy][wx] = 'wall';
  return g;
}

export function initialState(): GameState {
  const grid = makeMap();
  const t0: Tank = { id: 0, x: 2, y: 2, dir: Direction.Right, hp: 5, cooldown: 0 };
  const t1: Tank = { id: 1, x: 13, y: 13, dir: Direction.Left, hp: 5, cooldown: 0 };
  return { width: 16, height: 16, grid, tanks: [t0, t1], bullets: [], tick: 0, status: 'playing', winner: null };
}

export function senseFor(st: GameState, tank: Tank): { enemyAhead: boolean, wallAhead: boolean } {
  const [dx, dy] = dirVec(tank.dir);
  // Wall just ahead
  const nx = tank.x + dx, ny = tank.y + dy;
  const aheadTile = tileAt(st, nx, ny);
  const wallAhead = aheadTile !== 'empty';
  // Enemy ahead by ray
  let x = tank.x + dx, y = tank.y + dy;
  let enemyAhead = false;
  while (inBounds(st, x, y)) {
    const tile = tileAt(st, x, y);
    if (tile === 'wall') break;
    const enemy = st.tanks.find(t => t.hp > 0 && t.id !== tank.id && t.x === x && t.y === y);
    if (enemy) { enemyAhead = true; break; }
    x += dx; y += dy;
  }
  return { enemyAhead, wallAhead };
}

function applyMovement(st: GameState, intents: Map<number, Action>) {
  // Compute targets
  const targets = new Map<number, { x: number, y: number }>();
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    const act = intents.get(t.id);
    if (act === 'MOVE') {
      const [dx, dy] = dirVec(t.dir);
      targets.set(t.id, { x: t.x + dx, y: t.y + dy });
    }
  }
  // Resolve conflicts and walls
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    const act = intents.get(t.id);
    if (act === 'TURN_LEFT') t.dir = rotLeft(t.dir);
    else if (act === 'TURN_RIGHT') t.dir = rotRight(t.dir);
  }
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    const tgt = targets.get(t.id);
    if (!tgt) continue;
    const blocked = !inBounds(st, tgt.x, tgt.y) || tileAt(st, tgt.x, tgt.y) !== 'empty' || tankAt(st, tgt.x, tgt.y);
    // deny move if another also targets same tile
    const conflict = [...targets.entries()].some(([oid, o]) => oid !== t.id && o.x === tgt.x && o.y === tgt.y);
    if (!blocked && !conflict) { t.x = tgt.x; t.y = tgt.y; }
  }
}

function applyFire(st: GameState, intents: Map<number, Action>) {
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    if (t.cooldown > 0) continue;
    if (intents.get(t.id) === 'FIRE') {
      const [dx, dy] = dirVec(t.dir);
      const bx = t.x + dx, by = t.y + dy;
      if (inBounds(st, bx, by) && tileAt(st, bx, by) === 'empty' && !tankAt(st, bx, by)) {
        st.bullets.push({ x: bx, y: by, dir: t.dir });
        t.cooldown = 2;
      } else {
        // immediate hit if adjacent enemy or wall
        const enemy = st.tanks.find(o => o.hp > 0 && o.id !== t.id && o.x === bx && o.y === by);
        if (enemy) enemy.hp -= 1;
        t.cooldown = 2;
      }
    }
  }
}

function updateBullets(st: GameState) {
  const next: Bullet[] = [];
  for (const b of st.bullets) {
    const [dx, dy] = dirVec(b.dir);
    let nx = b.x + dx, ny = b.y + dy;
    let alive = true;
    if (!inBounds(st, nx, ny)) alive = false;
    else if (tileAt(st, nx, ny) !== 'empty') alive = false;
    else {
      const hit = st.tanks.find(t => t.hp > 0 && t.x === nx && t.y === ny);
      if (hit) { hit.hp -= 1; alive = false; }
    }
    if (alive) next.push({ x: nx, y: ny, dir: b.dir });
  }
  st.bullets = next;
}

function updateCooldowns(st: GameState) {
  for (const t of st.tanks) if (t.cooldown > 0) t.cooldown -= 1;
}

export function toView(st: GameState, id: number): TankView {
  const t = st.tanks[id];
  const sense = senseFor(st, t);
  return { id: t.id, x: t.x, y: t.y, dir: t.dir, hp: t.hp, tick: st.tick, sense };
}

export function step(st: GameState, ctrls: AIController[], rng: RNG): GameState {
  if (st.status !== 'playing') return st;
  // Decide actions
  const intents = new Map<number, Action>();
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    const ctrl = ctrls[t.id];
    const action = ctrl(toView(st, t.id), () => rng.next());
    intents.set(t.id, action);
  }
  applyMovement(st, intents);
  applyFire(st, intents);
  updateBullets(st);
  updateCooldowns(st);
  st.tick += 1;
  // End conditions
  const alive = st.tanks.filter(t => t.hp > 0);
  if (alive.length <= 1) {
    st.status = 'gameover';
    st.winner = alive.length === 1 ? alive[0].id : null;
  }
  if (st.tick >= 1000 && st.status === 'playing') { st.status = 'gameover'; st.winner = null; }
  return st;
}

