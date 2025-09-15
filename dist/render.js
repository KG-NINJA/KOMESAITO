// #KGNINJA
import { dirVec } from './engine.js';

function angleForDir(dir){ return [-Math.PI/2, 0, Math.PI/2, Math.PI][dir]; }
function lerp(a,b,t){ return a + (b - a) * t; }

export class Renderer {
  constructor(canvas, opts) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not available');
    this.canvas = canvas;
    this.ctx = ctx;
    this.opts = Object.assign({ cell: 32 }, opts || {});
  }
  clear() { const { ctx, canvas } = this; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  drawGrid(w, h) {
    const { ctx } = this; const s = this.opts.cell;
    ctx.strokeStyle = '#1f2448'; ctx.lineWidth = 1;
    for (let x = 0; x <= w; x++) { ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo(x * s, h * s); ctx.stroke(); }
    for (let y = 0; y <= h; y++) { ctx.beginPath(); ctx.moveTo(0, y * s); ctx.lineTo(w * s, y * s); ctx.stroke(); }
  }
  drawTiles(grid) {
    const { ctx } = this; const s = this.opts.cell;
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[0].length; x++) {
        if (grid[y][x] === 'wall') { ctx.fillStyle = '#2a305f'; ctx.fillRect(x * s, y * s, s, s); }
      }
    }
  }
  drawTank(x, y, dir, color) {
    const { ctx } = this; const s = this.opts.cell;
    const cx = x * s + s / 2, cy = y * s + s / 2; const r = s * 0.42;
    const angle = [ -Math.PI/2, 0, Math.PI/2, Math.PI ][dir];
    const p0 = [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    const p1 = [cx + Math.cos(angle + 2.5) * r, cy + Math.sin(angle + 2.5) * r];
    const p2 = [cx + Math.cos(angle - 2.5) * r, cy + Math.sin(angle - 2.5) * r];
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.fill();
    const [dx, dy] = dirVec(dir); ctx.strokeStyle = '#e0e6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * r, cy + dy * r); ctx.stroke();
  }
  drawBullets(bullets) { const { ctx } = this; const s = this.opts.cell; ctx.fillStyle = '#fdd835'; for (const b of bullets) ctx.fillRect(b.x * s + s*0.35, b.y * s + s*0.35, s*0.3, s*0.3); }
  drawRockets(rockets) { const { ctx } = this; const s = this.opts.cell; if (!rockets) return; ctx.fillStyle = '#ff8a65'; for (const r of rockets) ctx.fillRect(r.x * s + s*0.25, r.y * s + s*0.25, s*0.5, s*0.5); }
  drawHud(st) { /* reserved */ }
  drawInterpolated(st, prev, alpha, effects) {
    const { ctx } = this; const s = this.opts.cell;
    this.clear(); this.drawTiles(st.grid); this.drawGrid(st.width, st.height);
    const colors = ['#ef5350', '#26c6da'];
    for (const t of st.tanks) {
      if (t.hp <= 0) continue;
      if (prev && prev.tanks) {
        const pt = prev.tanks.find(p => p.id === t.id) || t;
        const moved = (pt.x !== t.x) || (pt.y !== t.y);
        const x = moved ? lerp(pt.x, t.x, alpha) : t.x;
        const y = moved ? lerp(pt.y, t.y, alpha) : t.y;
        const pa = angleForDir(pt.dir), ca = angleForDir(t.dir);
        let delta = ca - pa; while (delta > Math.PI) delta -= Math.PI*2; while (delta < -Math.PI) delta += Math.PI*2;
        const ang = pa + delta * alpha;
        const cx = x * s + s/2, cy = y * s + s/2; const r = s*0.42;
        const p0 = [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
        const p1 = [cx + Math.cos(ang + 2.5) * r, cy + Math.sin(ang + 2.5) * r];
        const p2 = [cx + Math.cos(ang - 2.5) * r, cy + Math.sin(ang - 2.5) * r];
        ctx.fillStyle = colors[t.id] || '#90caf9'; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.fill();
        const [dx, dy] = dirVec(t.dir); ctx.strokeStyle = '#e0e6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * r, cy + dy * r); ctx.stroke();
      } else {
        this.drawTank(t.x, t.y, t.dir, colors[t.id] || '#90caf9');
      }
      // scanning ring indicator
      if (t.scanBusy && t.scanBusy > 0) {
        const cx = t.x * s + s/2, cy = t.y * s + s/2; const rr = s*0.6; const pulse = 0.3 + 0.2 * Math.sin(performance.now()/180);
        this.ctx.strokeStyle = `rgba(120,200,255,${0.6 + pulse})`; this.ctx.lineWidth = 2;
        this.ctx.beginPath(); this.ctx.arc(cx, cy, rr, 0, Math.PI*2); this.ctx.stroke();
      }
    }
    // Bullets with sub-tile interpolation
    ctx.fillStyle = '#fdd835';
    for (const b of st.bullets) {
      const [dx, dy] = dirVec(b.dir);
      const fx = b.x - dx * (1 - alpha);
      const fy = b.y - dy * (1 - alpha);
      ctx.fillRect(fx * s + s*0.35, fy * s + s*0.35, s*0.3, s*0.3);
    }
    // Rockets (slower, larger)
    ctx.fillStyle = '#ff8a65';
    if (st.rockets) {
      for (const r of st.rockets) {
        const [dx, dy] = dirVec(r.dir);
        const frac = Math.max(0, Math.min(1, r.prog || 0));
        const fx = r.x - dx * (1 - frac);
        const fy = r.y - dy * (1 - frac);
        ctx.fillRect(fx * s + s*0.25, fy * s + s*0.25, s*0.5, s*0.5);
      }
    }
    // Effects layer
    if (effects && effects.length) {
      const now = performance.now();
      for (const e of effects) {
        const tt = (now - e.start) / e.life; const t = Math.max(0, Math.min(1, tt));
        if (e.type === 'muzzle') {
          const cx = e.x * s + s/2, cy = e.y * s + s/2; const r = s * (0.2 + 0.2 * (1 - t));
          const ang = angleForDir(e.dir);
          const p0 = [cx + Math.cos(ang) * r*1.8, cy + Math.sin(ang) * r*1.8];
          const p1 = [cx + Math.cos(ang + 2.8) * r, cy + Math.sin(ang + 2.8) * r];
          const p2 = [cx + Math.cos(ang - 2.8) * r, cy + Math.sin(ang - 2.8) * r];
          ctx.fillStyle = `rgba(255,220,120,${1 - t})`;
          ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.fill();
        } else if (e.type === 'explosion') {
          const cx = e.x * s + s/2, cy = e.y * s + s/2; const R = s * (0.3 + 0.4 * t);
          ctx.save(); ctx.translate(cx, cy);
          ctx.fillStyle = `rgba(255,150,80,${1 - t})`;
          ctx.beginPath(); const spikes = 8; const inner = R * 0.5;
          for (let i=0;i<spikes*2;i++){
            const rr = (i%2===0)? R : inner; const ang = (i / (spikes*2)) * Math.PI*2;
            const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
            if (i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.fill(); ctx.restore();
        }
      }
    }
    // Tick overlay
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 18px ui-monospace, monospace'; ctx.fillText(`Tick ${st.tick}`, 8, 22);
  }
  draw(st, prev, alpha, effects){ this.drawInterpolated(st, prev, alpha ?? 1, effects); }
}
