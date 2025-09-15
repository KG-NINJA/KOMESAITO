// #KGNINJA
import { compileProgram, parseProgram, DEFAULT_AI_1, DEFAULT_AI_2 } from './ai.js';
import { initialState, makeRng, step } from './engine.js';
import { AIController, AIProgram } from './types.js';
import { Renderer } from './render.js';

function $(id: string) { return document.getElementById(id)!; }

let state = initialState();
let rng = makeRng(1234);
let renderer: Renderer;
let controllers: AIController[] = [];
let timer: number | null = null;

function setupRenderer() {
  const canvas = $('game') as HTMLCanvasElement;
  renderer = new Renderer(canvas, { cell: 32 });
}

function defaultPrograms(): [AIProgram, AIProgram] {
  return [DEFAULT_AI_1, DEFAULT_AI_2];
}

function setEditors(p1: AIProgram, p2: AIProgram) {
  const ai1 = $('ai1') as HTMLTextAreaElement;
  const ai2 = $('ai2') as HTMLTextAreaElement;
  ai1.value = JSON.stringify(p1, null, 2);
  ai2.value = JSON.stringify(p2, null, 2);
}

function compileFromEditors(): [AIController, AIController] {
  const ai1 = $('ai1') as HTMLTextAreaElement;
  const ai2 = $('ai2') as HTMLTextAreaElement;
  const p1 = parseProgram(ai1.value);
  const p2 = parseProgram(ai2.value);
  return [compileProgram(p1), compileProgram(p2)];
}

function updateStatus() {
  const stats = $('stats');
  stats.textContent = `Tick: ${state.tick} | HP: Red ${state.tanks[0].hp} vs Cyan ${state.tanks[1].hp}`;
  const status = $('status');
  status.textContent = state.status === 'gameover'
    ? (state.winner != null ? `Game Over — Winner: ${state.winner === 0 ? 'Red' : 'Cyan'}` : 'Game Over — Draw')
    : 'Playing';
}

function render() {
  renderer.draw(state);
  updateStatus();
}

function doStep() {
  state = step(state, controllers, rng);
  render();
  if (state.status === 'gameover' && timer != null) { stop(); }
}

function play() {
  if (timer != null) return;
  ($('btn-play') as HTMLButtonElement).disabled = true;
  ($('btn-pause') as HTMLButtonElement).disabled = false;
  timer = window.setInterval(doStep, 160);
}

function stop() {
  if (timer != null) { window.clearInterval(timer); timer = null; }
  ($('btn-play') as HTMLButtonElement).disabled = false;
  ($('btn-pause') as HTMLButtonElement).disabled = true;
}

function reset() {
  stop();
  state = initialState();
  rng = makeRng(1234);
  render();
}

function showError(e: any) {
  const box = $('error');
  box.textContent = e?.message || String(e);
  setTimeout(() => { box.textContent = ''; }, 4000);
}

function applyAI() {
  try {
    controllers = compileFromEditors();
    reset();
  } catch (e) { showError(e); }
}

function wireUI() {
  $('btn-play')!.addEventListener('click', play);
  $('btn-pause')!.addEventListener('click', stop);
  $('btn-step')!.addEventListener('click', doStep);
  $('btn-reset')!.addEventListener('click', reset);
  $('btn-apply')!.addEventListener('click', applyAI);
}

function main() {
  setupRenderer();
  setEditors(...defaultPrograms());
  controllers = compileFromEditors();
  render();
  wireUI();
}

window.addEventListener('DOMContentLoaded', main);

