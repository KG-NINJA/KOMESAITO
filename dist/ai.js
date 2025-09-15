// #KGNINJA
function compileCondition(expr) {
  const e = (expr||'').trim().toLowerCase();
  if (e === 'enemy_ahead') return (v) => v.sense.enemyAhead;
  if (e === 'wall_ahead') return (v) => v.sense.wallAhead;
  if (e === 'scanning') return (v) => !!v.scanning;
  if (e === 'has_scan') return (v) => !!(v.scan);
  if (e === 'scan_ahead') return (v) => {
    if (!v.scan) return false;
    const dx = v.scan.x - v.x, dy = v.scan.y - v.y;
    const d = v.dir;
    if (d===0) return dy < 0;
    if (d===1) return dx > 0;
    if (d===2) return dy > 0;
    return dx < 0;
  };
  if (e === 'scan_left') return (v) => {
    if (!v.scan) return false; const dx=v.scan.x - v.x, dy=v.scan.y - v.y, d=v.dir;
    if (d===0) return dx < 0; if (d===1) return dy < 0; if (d===2) return dx > 0; return dy > 0;
  };
  if (e === 'scan_right') return (v) => {
    if (!v.scan) return false; const dx=v.scan.x - v.x, dy=v.scan.y - v.y, d=v.dir;
    if (d===0) return dx > 0; if (d===1) return dy > 0; if (d===2) return dx < 0; return dy < 0;
  };
  if (e === 'scan_back') return (v) => {
    if (!v.scan) return false; const dx=v.scan.x - v.x, dy=v.scan.y - v.y, d=v.dir;
    if (d===0) return dy > 0; if (d===1) return dx < 0; if (d===2) return dy < 0; return dx > 0;
  };
  if (e === 'always' || e === 'else') return () => true;
  if (e.startsWith('random<')) {
    const p = Number(e.slice('random<'.length));
    const prob = isFinite(p) ? Math.max(0, Math.min(1, p)) : 0;
    return (_, rnd) => rnd() < prob;
  }
  return () => false;
}

function compileRule(r) { return { test: compileCondition(r.if), action: r.do }; }

export function compileProgram(prog) {
  const rules = (prog.rules || []).map(compileRule);
  return (view, rnd) => {
    for (const r of rules) if (r.test(view, rnd)) return r.action;
    return 'WAIT';
  };
}

export function parseProgram(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object') throw new Error('Invalid program: not an object');
  if (!Array.isArray(obj.rules)) throw new Error('Invalid program: missing rules[]');
  for (const [i, r] of obj.rules.entries()) {
    if (!r || typeof r !== 'object') throw new Error(`Rule ${i}: not an object`);
    if (typeof r.if !== 'string') throw new Error(`Rule ${i}: missing if`);
    if (typeof r.do !== 'string') throw new Error(`Rule ${i}: missing do`);
  }
  return obj;
}

export const DEFAULT_AI_1 = {
  name: 'Seeker',
  rules: [
    { if: 'enemy_ahead', do: 'FIRE' },
    { if: 'wall_ahead', do: 'TURN_RIGHT' },
    { if: 'random<0.1', do: 'TURN_LEFT' },
    { if: 'else', do: 'MOVE' },
  ],
};

export const DEFAULT_AI_2 = {
  name: 'Wanderer',
  rules: [
    { if: 'enemy_ahead', do: 'FIRE' },
    { if: 'wall_ahead', do: 'TURN_LEFT' },
    { if: 'random<0.2', do: 'TURN_RIGHT' },
    { if: 'else', do: 'MOVE' },
  ],
};
