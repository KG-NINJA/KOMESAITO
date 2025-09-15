// #KGNINJA
import { compileProgram, parseProgram, DEFAULT_AI_1, DEFAULT_AI_2 } from './ai.js';
import { initialState, makeRng, step } from './engine.js';
import { Renderer } from './render.js';
console.log('main module loaded');
import { Renderer3rd } from './render3rd.js';

function $(id) { return document.getElementById(id); }

let state = initialState();
let rng = makeRng(1234);
let renderer;
let renderer3rd;
let fpViewId = 0;
let controllers = [];
let timer = null;
const tickMs = 480; // slowed to 1/3 speed
let lastTickTime = performance.now();
let prevState = null; // snapshot for interpolation
let effects = []; // transient visual effects

// Enemy AI presets (JSON programs)
const ENEMY_PRESETS = {
  aggressive: {
    name: 'Aggressive Chaser',
    rules: [
      { if: 'enemy_ahead', do: 'FIRE' },
      { if: 'scan_ahead', do: 'MOVE' },
      { if: 'scan_left', do: 'TURN_LEFT' },
      { if: 'scan_right', do: 'TURN_RIGHT' },
      { if: 'scan_back', do: 'TURN_RIGHT' },
      { if: 'wall_ahead', do: 'TURN_RIGHT' },
      { if: 'random<0.15', do: 'SCAN' },
      { if: 'else', do: 'MOVE' },
    ],
  },
  runner: {
    name: 'Runner (Evade)',
    rules: [
      { if: 'enemy_ahead', do: 'TURN_RIGHT' },
      { if: 'scan_ahead', do: 'TURN_RIGHT' },
      { if: 'scan_left', do: 'TURN_RIGHT' },
      { if: 'scan_right', do: 'TURN_LEFT' },
      { if: 'scan_back', do: 'MOVE' },
      { if: 'wall_ahead', do: 'TURN_LEFT' },
      { if: 'random<0.2', do: 'SCAN' },
      { if: 'else', do: 'MOVE' },
    ],
  },
  ambush: {
    name: 'Ambush (Camper)',
    rules: [
      { if: 'enemy_ahead', do: 'FIRE' },
      { if: 'scan_ahead', do: 'FIRE' },
      { if: 'scan_left', do: 'TURN_LEFT' },
      { if: 'scan_right', do: 'TURN_RIGHT' },
      { if: 'scan_back', do: 'TURN_RIGHT' },
      { if: 'wall_ahead', do: 'TURN_RIGHT' },
      { if: 'random<0.2', do: 'SCAN' },
      { if: 'else', do: 'WAIT' },
    ],
  },
};

function snapshot(st){
  return {
    tanks: st.tanks.map(t => ({ id: t.id, x: t.x, y: t.y, dir: t.dir, hp: t.hp })),
    bullets: st.bullets.map(b => ({ x: b.x, y: b.y, dir: b.dir })),
    rockets: (st.rockets||[]).map(r => ({ x: r.x, y: r.y, dir: r.dir }))
  };
}

function setupRenderer() { const canvas = $('game'); renderer = new Renderer(canvas, { cell: 32 }); const canvas3d = $('game3d'); if (canvas3d) { try { renderer3rd = new Renderer3rd(canvas3d, { fovDeg: 70 }); } catch (e) { console.warn('TP init failed', e); } } }
function defaultPrograms() { return [DEFAULT_AI_1, DEFAULT_AI_2]; }
function setEditors(p1, p2) { $('ai1').value = JSON.stringify(p1, null, 2); $('ai2').value = JSON.stringify(p2, null, 2); }
function compileFromEditors() { const p1 = parseProgram($('ai1').value); const p2 = parseProgram($('ai2').value); return [compileProgram(p1), compileProgram(p2)]; }

function updateStatus() {
  $('stats').textContent = `Tick: ${state.tick} | HP: Red ${state.tanks[0].hp} vs Cyan ${state.tanks[1].hp}`;
  $('status').textContent = state.status === 'gameover' ? (state.winner != null ? `Game Over — Winner: ${state.winner === 0 ? 'Red' : 'Cyan'}` : 'Game Over — Draw') : 'Playing';
}
function render() { updateStatus(); }
function doStep() {
  console.log('tick before', state.tick);
  // snapshot before stepping
  prevState = snapshot(state);
  state = step(state, controllers, rng);
  lastTickTime = performance.now();
  // detect muzzle flashes (new bullets)
  const prevSet = new Set(prevState.bullets.map(b => `${b.x},${b.y},${b.dir}`));
  const currSet = new Set(state.bullets.map(b => `${b.x},${b.y},${b.dir}`));
  for (const b of state.bullets) {
    const [dx, dy] = (function(dir){ return dir===0?[0,-1]:dir===1?[1,0]:dir===2?[0,1]:[-1,0]; })(b.dir);
    const keyPrev = `${b.x - dx},${b.y - dy},${b.dir}`;
    if (!prevSet.has(keyPrev)) {
      effects.push({ type:'muzzle', x: b.x - dx*0.5, y: b.y - dy*0.5, dir: b.dir, start: performance.now(), life: 150 });
    }
  }
  // detect explosions (bullets that disappeared)
  for (const pb of prevState.bullets) {
    const [dx, dy] = (function(dir){ return dir===0?[0,-1]:dir===1?[1,0]:dir===2?[0,1]:[-1,0]; })(pb.dir);
    const nx = pb.x + dx, ny = pb.y + dy;
    const keyNext = `${nx},${ny},${pb.dir}`;
    if (!currSet.has(keyNext)) {
      effects.push({ type:'explosion', x: nx, y: ny, start: performance.now(), life: 300 });
    }
  }
  // detect rocket muzzles
  const prevR = new Set((prevState.rockets||[]).map(r => `${r.x},${r.y},${r.dir}`));
  for (const r of (state.rockets||[])) {
    const [dx,dy] = (function(dir){ return dir===0?[0,-1]:dir===1?[1,0]:dir===2?[0,1]:[-1,0]; })(r.dir);
    const keyPrev = `${r.x - dx},${r.y - dy},${r.dir}`;
    if (!prevR.has(keyPrev)) effects.push({type:'muzzle', x:r.x - dx*0.5, y:r.y - dy*0.5, dir:r.dir, start: performance.now(), life: 200});
  }
  // ingest engine-reported booms (rocket explosions)
  if (state.booms && state.booms.length){
    for (const b of state.booms){ effects.push({ type:'explosion', x:b.x, y:b.y, start: performance.now(), life: 380 }); }
    state.booms = [];
  }
  render();
  console.log('tick after', state.tick);
  if (state.status === 'gameover' && timer != null) { stop(); }
}
function play() { if (timer != null) return; $('btn-play').disabled = true; $('btn-pause').disabled = false; console.log('start interval'); timer = window.setInterval(doStep, tickMs); doStep(); }
function stop() { if (timer != null) { window.clearInterval(timer); timer = null; } $('btn-play').disabled = false; $('btn-pause').disabled = true; }
function reset() { stop(); state = initialState(); rng = makeRng(1234); render(); }
function showError(e) { const box = $('error'); box.textContent = (e && e.message) || String(e); setTimeout(() => { box.textContent=''; }, 4000); }
function applyAI() { try { controllers = compileFromEditors(); reset(); const ap = document.getElementById('auto-play'); if (ap && ap.checked) play(); } catch (e) { showError(e); } }

function wireUI() {
  console.log('bind play'); $('btn-play').addEventListener('click', () => { console.log('click play'); play(); });
  console.log('bind pause'); $('btn-pause').addEventListener('click', () => { console.log('click pause'); stop(); });
  console.log('bind step'); $('btn-step').addEventListener('click', () => { console.log('click step'); doStep(); });
  console.log('bind reset'); $('btn-reset').addEventListener('click', () => { console.log('click reset'); reset(); });
  console.log('bind apply'); $('btn-apply').addEventListener('click', () => { console.log('click apply'); applyAI(); });
  const testBtn = $('btn-test'); if (testBtn) { console.log('bind test'); testBtn.addEventListener('click', () => { console.log('click test'); for (let i=0;i<10;i++) doStep(); }); }
  const fpRed = document.getElementById('fp-red'); const fpCyan = document.getElementById('fp-cyan');
  if (fpRed) fpRed.addEventListener('change', () => { if (fpRed.checked) fpViewId = 0; });
  if (fpCyan) fpCyan.addEventListener('change', () => { if (fpCyan.checked) fpViewId = 1; });
  // Tweet my AI (AI 1)
  const tweetBtn = document.getElementById('btn-tweet-ai1');
  if (tweetBtn) {
    tweetBtn.addEventListener('click', () => {
      try {
        const ai1 = document.getElementById('ai1');
        const raw = (ai1 && ai1.value) ? ai1.value : '';
        // Try to minify JSON to save characters
        let programStr = raw.trim();
        try { const obj = JSON.parse(programStr); programStr = JSON.stringify(obj); } catch (_) { /* keep raw */ }
        const label = 'My Tank AI (Red)';
        const tags = '#KGNINJA #KOMESAITO';
        let tweet = `${label}\n${programStr}\n${tags}`;
        const MAX = 280;
        if (tweet.length > MAX) {
          const overhead = (label.length + 1 /*\n*/ + 1 /*\n*/ + tags.length);
          const room = Math.max(0, MAX - overhead - 1); // for ellipsis
          const shortened = programStr.slice(0, room) + '…';
          tweet = `${label}\n${shortened}\n${tags}`;
        }
        const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweet);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        const box = document.getElementById('error'); if (box) box.textContent = 'Tweet error: ' + (e && e.message ? e.message : String(e));
      }
    });
  }
  const presetSel = document.getElementById('enemy-preset');
  if (presetSel) {
    presetSel.addEventListener('change', () => {
      const val = presetSel.value;
      if (!val || val === 'custom') return;
      const preset = ENEMY_PRESETS[val];
      if (preset) {
        const ai2 = document.getElementById('ai2');
        ai2.value = JSON.stringify(preset, null, 2);
        try { applyAI(); } catch (_) { /* ignore */ }
      }
    });
  }
}
function main() { setupRenderer(); setEditors(...defaultPrograms()); controllers = compileFromEditors(); prevState = snapshot(state); render(); wireUI(); requestAnimationFrame(animate); }
function animate(){
  const now = performance.now();
  // prune effects
  effects = effects.filter(e => (now - e.start) < e.life);
  const alpha = Math.max(0, Math.min(1, (now - lastTickTime) / tickMs));
  try { renderer.draw(state, prevState, alpha, effects); } catch (e) { renderer.draw(state); }
  if (renderer3rd) { try { renderer3rd.draw(state, prevState, alpha, effects, fpViewId); } catch (e) { /* ignore */ } }
  requestAnimationFrame(animate);
}
window.addEventListener('DOMContentLoaded', main);

// Keyboard shortcuts for redundancy
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); if (timer == null) { console.log('key play'); play(); } else { console.log('key pause'); stop(); } }
  else if (k === 's') { console.log('key step'); doStep(); }
  else if (k === 'r') { console.log('key reset'); reset(); }
  else if (k === 'a') { console.log('key apply'); applyAI(); }
});
