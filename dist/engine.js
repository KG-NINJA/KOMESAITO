// #KGNINJA
import { Direction } from './types.js';

export function makeRng(seed = 123456789) {
  let s = seed >>> 0;
  return {
    seed,
    next() {
      s = (1664525 * s + 1013904223) >>> 0;
      return (s & 0xffffffff) / 0x100000000;
    },
  };
}

export function dirVec(d) {
  switch (d) {
    case Direction.Up: return [0, -1];
    case Direction.Right: return [1, 0];
    case Direction.Down: return [0, 1];
    case Direction.Left: return [-1, 0];
  }
}

export function rotLeft(d) { return ((d + 3) & 3); }
export function rotRight(d) { return ((d + 1) & 3); }

export function inBounds(st, x, y) { return x >= 0 && y >= 0 && x < st.width && y < st.height; }
export function tileAt(st, x, y) { if (!inBounds(st, x, y)) return null; return st.grid[y][x]; }
export function tankAt(st, x, y) { for (const t of st.tanks) if (t.hp > 0 && t.x === x && t.y === y) return t; return null; }

export function makeMap(width = 16, height = 16) {
  const g = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      row.push(border ? 'wall' : 'empty');
    }
    g.push(row);
  }
  const walls = [[5,5],[5,6],[5,7],[10,8],[10,9],[10,10],[8,3],[9,3]];
  for (const [wx, wy] of walls) g[wy][wx] = 'wall';
  return g;
}

export function initialState() {
  const grid = makeMap();
  const t0 = { id: 0, x: 2, y: 2, dir: Direction.Right, hp: 5, cooldown: 0, rcd: 0, scanBusy: 0, lastScan: null };
  const t1 = { id: 1, x: 13, y: 13, dir: Direction.Left, hp: 5, cooldown: 0, rcd: 0, scanBusy: 0, lastScan: null };
  return { width: 16, height: 16, grid, tanks: [t0, t1], bullets: [], rockets: [], booms: [], tick: 0, status: 'playing', winner: null };
}

export function senseFor(st, tank) {
  const [dx, dy] = dirVec(tank.dir);
  const nx = tank.x + dx, ny = tank.y + dy;
  const aheadTile = tileAt(st, nx, ny);
  const wallAhead = aheadTile !== 'empty';
  let x = tank.x + dx, y = tank.y + dy; let enemyAhead = false;
  while (inBounds(st, x, y)) {
    const tile = tileAt(st, x, y); if (tile === 'wall') break;
    const enemy = st.tanks.find(t => t.hp > 0 && t.id !== tank.id && t.x === x && t.y === y);
    if (enemy) { enemyAhead = true; break; }
    x += dx; y += dy;
  }
  return { enemyAhead, wallAhead };
}

function applyMovement(st, intents) {
  const targets = new Map();
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    if (t.scanBusy && t.scanBusy > 0) continue;
    const act = intents.get(t.id);
    if (act === 'MOVE') {
      const [dx, dy] = dirVec(t.dir);
      targets.set(t.id, { x: t.x + dx, y: t.y + dy });
    }
  }
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    if (t.scanBusy && t.scanBusy > 0) continue;
    const act = intents.get(t.id);
    if (act === 'TURN_LEFT') t.dir = rotLeft(t.dir);
    else if (act === 'TURN_RIGHT') t.dir = rotRight(t.dir);
  }
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    const tgt = targets.get(t.id);
    if (!tgt) continue;
    const blocked = !inBounds(st, tgt.x, tgt.y) || tileAt(st, tgt.x, tgt.y) !== 'empty' || tankAt(st, tgt.x, tgt.y);
    const conflict = [...targets.entries()].some(([oid, o]) => oid !== t.id && o.x === tgt.x && o.y === tgt.y);
    if (!blocked && !conflict) { t.x = tgt.x; t.y = tgt.y; }
  }
}

function applyFire(st, intents) {
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    if (t.scanBusy && t.scanBusy > 0) continue;
    const act = intents.get(t.id);
    if (act === 'FIRE' && t.cooldown <= 0) {
      const [dx, dy] = dirVec(t.dir);
      const bx = t.x + dx, by = t.y + dy;
      if (inBounds(st, bx, by) && tileAt(st, bx, by) === 'empty' && !tankAt(st, bx, by)) {
        st.bullets.push({ x: bx, y: by, dir: t.dir });
        t.cooldown = 2;
      } else {
        const enemy = st.tanks.find(o => o.hp > 0 && o.id !== t.id && o.x === bx && o.y === by);
        if (enemy) enemy.hp -= 1;
        t.cooldown = 2;
      }
    } else if (act === 'FIRE_ROCKET' && (t.rcd == null || t.rcd <= 0)) {
      const [dx, dy] = dirVec(t.dir);
      const rx = t.x + dx, ry = t.y + dy;
      if (inBounds(st, rx, ry) && tileAt(st, rx, ry) === 'empty' && !tankAt(st, rx, ry)) {
        // Rockets move slower and aim for 3 cells ahead; explode on impact or when travel>=3
        st.rockets = st.rockets || [];
        st.rockets.push({ x: rx, y: ry, dir: t.dir, prog: 0, travel: 0 });
        t.rcd = 6; // longer cooldown
      } else {
        // immediate explosion in front if blocked
        explodeAt(st, rx, ry, 2);
        t.rcd = 6;
      }
    }
  }
}

function applyScanStart(st, intents) {
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    const act = intents.get(t.id);
    if (act === 'SCAN' && (!t.scanBusy || t.scanBusy <= 0)) {
      t.scanBusy = 3; // freeze 3 ticks; result after completion
      t.lastScan = null; // clear old result
    }
  }
}

function updateBullets(st) {
  const next = [];
  for (const b of st.bullets) {
    const [dx, dy] = dirVec(b.dir);
    let nx = b.x + dx, ny = b.y + dy; let alive = true;
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

function applyDamage(st, x, y, dmg){ const t = st.tanks.find(tt => tt.hp > 0 && tt.x === x && tt.y === y); if (t) t.hp -= dmg; }
function explodeAt(st, x, y, power){
  // power 2 at center, 1 for neighbors
  applyDamage(st, x, y, power);
  const nb = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dx,dy] of nb) applyDamage(st, x+dx, y+dy, 1);
  st.booms = st.booms || []; st.booms.push({ x, y });
}

function updateRockets(st){
  if (!st.rockets) st.rockets = [];
  const next = [];
  for (const r of st.rockets) {
    r.prog = (r.prog || 0) + 0.5; // slower
    let moved = false;
    while (r.prog >= 1) {
      r.prog -= 1; moved = true;
      const [dx,dy] = dirVec(r.dir);
      const nx = r.x + dx, ny = r.y + dy;
      // explode on impact/out-of-bounds
      if (!inBounds(st, nx, ny) || tileAt(st, nx, ny) !== 'empty') { explodeAt(st, nx, ny, 2); moved = false; r.travel = 999; break; }
      const hit = st.tanks.find(t => t.hp > 0 && t.x === nx && t.y === ny);
      if (hit) { explodeAt(st, nx, ny, 2); moved = false; r.travel = 999; break; }
      r.x = nx; r.y = ny; r.travel = (r.travel||0)+1;
      if (r.travel >= 3) { explodeAt(st, r.x, r.y, 2); moved = false; break; }
    }
    if ((r.travel||0) < 3 && moved || (r.prog>0 && (r.travel||0) < 3)) next.push(r);
  }
  st.rockets = next;
}

function updateCooldowns(st) { for (const t of st.tanks) if (t.cooldown > 0) t.cooldown -= 1; }
function updateRocketCooldowns(st){ for (const t of st.tanks) if (t.rcd != null && t.rcd > 0) t.rcd -= 1; }

function updateScanning(st){
  for (const t of st.tanks) {
    if (t.scanBusy && t.scanBusy > 0) {
      t.scanBusy -= 1;
      if (t.scanBusy === 0) {
        const enemy = st.tanks.find(o => o.hp > 0 && o.id !== t.id);
        if (enemy) t.lastScan = { x: enemy.x, y: enemy.y, tick: st.tick };
      }
    }
  }
}

export function toView(st, id) {
  const t = st.tanks[id];
  const sense = senseFor(st, t);
  return { id: t.id, x: t.x, y: t.y, dir: t.dir, hp: t.hp, tick: st.tick, sense, scanning: !!(t.scanBusy && t.scanBusy>0), scan: t.lastScan };
}

export function step(st, ctrls, rng) {
  if (st.status !== 'playing') return st;
  const intents = new Map();
  for (const t of st.tanks) {
    if (t.hp <= 0) continue;
    const ctrl = ctrls[t.id];
    const action = ctrl(toView(st, t.id), () => rng.next());
    intents.set(t.id, (t.scanBusy && t.scanBusy>0) ? 'WAIT' : action);
  }
  applyScanStart(st, intents);
  applyMovement(st, intents);
  applyFire(st, intents);
  updateBullets(st);
  updateRockets(st);
  updateCooldowns(st);
  updateRocketCooldowns(st);
  updateScanning(st);
  st.tick += 1;
  const alive = st.tanks.filter(t => t.hp > 0);
  if (alive.length <= 1) { st.status = 'gameover'; st.winner = alive.length === 1 ? alive[0].id : null; }
  if (st.tick >= 1000 && st.status === 'playing') { st.status = 'gameover'; st.winner = null; }
  return st;
}
