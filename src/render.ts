// #KGNINJA
import { Direction, GameState, Tile } from './types.js';
import { dirVec } from './engine.js';

export interface RenderOptions { cell: number }

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private opts: RenderOptions;
  constructor(private canvas: HTMLCanvasElement, opts?: Partial<RenderOptions>) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not available');
    this.ctx = ctx;
    this.opts = { cell: 32, ...opts } as RenderOptions;
  }

  clear() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  drawGrid(w: number, h: number) {
    const { ctx } = this; const s = this.opts.cell;
    ctx.strokeStyle = '#1f2448'; ctx.lineWidth = 1;
    for (let x = 0; x <= w; x++) { ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo(x * s, h * s); ctx.stroke(); }
    for (let y = 0; y <= h; y++) { ctx.beginPath(); ctx.moveTo(0, y * s); ctx.lineTo(w * s, y * s); ctx.stroke(); }
  }

  drawTiles(grid: Tile[][]) {
    const { ctx } = this; const s = this.opts.cell;
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[0].length; x++) {
        if (grid[y][x] === 'wall') {
          ctx.fillStyle = '#2a305f';
          ctx.fillRect(x * s, y * s, s, s);
        }
      }
    }
  }

  drawTank(x: number, y: number, dir: Direction, color: string) {
    const { ctx } = this; const s = this.opts.cell;
    const cx = x * s + s / 2, cy = y * s + s / 2; const r = s * 0.42;
    // Triangle pointing to dir
    const angle = [ -Math.PI/2, 0, Math.PI/2, Math.PI ][dir];
    const p0 = [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    const p1 = [cx + Math.cos(angle + 2.5) * r, cy + Math.sin(angle + 2.5) * r];
    const p2 = [cx + Math.cos(angle - 2.5) * r, cy + Math.sin(angle - 2.5) * r];
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.fill();
    // Barrel line
    const [dx, dy] = dirVec(dir); ctx.strokeStyle = '#e0e6ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * r, cy + dy * r); ctx.stroke();
  }

  drawBullets(bullets: { x: number, y: number }[]) {
    const { ctx } = this; const s = this.opts.cell;
    ctx.fillStyle = '#fdd835';
    for (const b of bullets) ctx.fillRect(b.x * s + s*0.35, b.y * s + s*0.35, s*0.3, s*0.3);
  }

  drawHud(st: GameState) {
    const { ctx, opts } = this; const s = opts.cell;
    const y = st.height * s + 14; // reserved space if needed
    // Not drawing extra HUD on canvas for now
  }

  draw(st: GameState) {
    this.clear();
    this.drawTiles(st.grid);
    this.drawGrid(st.width, st.height);
    const colors = ['#ef5350', '#26c6da'];
    for (const t of st.tanks) if (t.hp > 0) this.drawTank(t.x, t.y, t.dir, colors[t.id] || '#90caf9');
    this.drawBullets(st.bullets);
  }
}

