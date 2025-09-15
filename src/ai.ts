// #KGNINJA
import { Action, AIController, AIProgram, AIRule, TankView } from './types.js';

type CondFn = (view: TankView, rnd: () => number) => boolean;

function compileCondition(expr: string): CondFn {
  const e = expr.trim().toLowerCase();
  if (e === 'enemy_ahead') return (v) => v.sense.enemyAhead;
  if (e === 'wall_ahead') return (v) => v.sense.wallAhead;
  if (e === 'always' || e === 'else') return () => true;
  if (e.startsWith('random<')) {
    const p = Number(e.slice('random<'.length));
    const prob = isFinite(p) ? Math.max(0, Math.min(1, p)) : 0;
    return (_, rnd) => rnd() < prob;
  }
  // Unknown condition -> never true
  return () => false;
}

function compileRule(r: AIRule): { test: CondFn; action: Action } {
  return { test: compileCondition(r.if), action: r.do };
}

export function compileProgram(prog: AIProgram): AIController {
  const rules = (prog.rules || []).map(compileRule);
  return (view: TankView, rnd: () => number): Action => {
    for (const r of rules) if (r.test(view, rnd)) return r.action;
    return 'WAIT';
  };
}

export function parseProgram(jsonText: string): AIProgram {
  const obj = JSON.parse(jsonText);
  if (!obj || typeof obj !== 'object') throw new Error('Invalid program: not an object');
  if (!Array.isArray(obj.rules)) throw new Error('Invalid program: missing rules[]');
  for (const [i, r] of obj.rules.entries()) {
    if (!r || typeof r !== 'object') throw new Error(`Rule ${i}: not an object`);
    if (typeof r.if !== 'string') throw new Error(`Rule ${i}: missing if`);
    if (typeof r.do !== 'string') throw new Error(`Rule ${i}: missing do`);
  }
  return obj as AIProgram;
}

export const DEFAULT_AI_1: AIProgram = {
  name: 'Seeker',
  rules: [
    { if: 'enemy_ahead', do: 'FIRE' },
    { if: 'wall_ahead', do: 'TURN_RIGHT' },
    { if: 'random<0.1', do: 'TURN_LEFT' },
    { if: 'else', do: 'MOVE' },
  ],
};

export const DEFAULT_AI_2: AIProgram = {
  name: 'Wanderer',
  rules: [
    { if: 'enemy_ahead', do: 'FIRE' },
    { if: 'wall_ahead', do: 'TURN_LEFT' },
    { if: 'random<0.2', do: 'TURN_RIGHT' },
    { if: 'else', do: 'MOVE' },
  ],
};

