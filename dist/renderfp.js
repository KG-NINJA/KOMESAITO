// #KGNINJA - First-Person (raycast) renderer

function angleForDir(dir){ return [-Math.PI/2, 0, Math.PI/2, Math.PI][dir]; }
function lerp(a,b,t){ return a + (b - a) * t; }

export class RendererFP {
  constructor(canvas, opts){
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not available');
    this.canvas = canvas; this.ctx = ctx;
    this.opts = Object.assign({ fovDeg: 60, maxDepth: 20, step: 0.02, wallShade: ['#4b548f', '#3b437a', '#2b335f'] }, opts||{});
  }

  draw(state, prev, alpha, effects, viewTankId=0){
    const { ctx, canvas } = this; const W = canvas.width, H = canvas.height;
    // Clear and sky/floor
    ctx.fillStyle = '#0b102a'; ctx.fillRect(0,0,W,H/2);
    ctx.fillStyle = '#0a0d20'; ctx.fillRect(0,H/2,W,H/2);

    const tank = state.tanks[viewTankId]; if (!tank || tank.hp<=0) return;
    const pt = prev && prev.tanks ? prev.tanks.find(p=>p.id===tank.id) : null;
    // Camera position/orientation
    const cx = pt ? lerp(pt.x+0.5, tank.x+0.5, alpha??1) : (tank.x+0.5);
    const cy = pt ? lerp(pt.y+0.5, tank.y+0.5, alpha??1) : (tank.y+0.5);
    const pa = pt ? angleForDir(pt.dir) : angleForDir(tank.dir);
    const ca = angleForDir(tank.dir);
    let da = ca - pa; while(da>Math.PI) da -= Math.PI*2; while(da<-Math.PI) da += Math.PI*2;
    const camAng = pa + (alpha??1)*da;

    const fov = (this.opts.fovDeg * Math.PI) / 180;
    const rays = W; // one ray per pixel column for simplicity
    const step = this.opts.step;
    const maxDepth = this.opts.maxDepth;

    // Helper to sample grid and enemies
    function tileAt(x,y){ if (x<0||y<0||x>=state.width||y>=state.height) return 'wall'; return state.grid[y|0][x|0]; }
    function enemyAt(x,y){ for(const t of state.tanks){ if (t.hp>0 && t.id!==tank.id && (t.x|0)===(x|0) && (t.y|0)===(y|0)) return t; } return null; }

    for (let i=0;i<rays;i++){
      const screen = (i / (rays-1)) - 0.5; // -0.5..0.5
      const ang = camAng + screen * fov;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      let dist = 0; let hitWall = false; let hitEnemy = false;
      let shade = 0; // 0 near .. 2 far
      let sx=cx, sy=cy;
      for (let d=0; d<maxDepth/step; d++){
        sx += dx*step; sy += dy*step; dist += step;
        const tile = tileAt(sx,sy);
        if (enemyAt(sx,sy)) { hitEnemy = true; break; }
        if (tile === 'wall') { hitWall = true; shade = Math.min(2, (dist>6)?2:(dist>3)?1:0); break; }
        if (sx<0||sy<0||sx>=state.width||sy>=state.height){ hitWall = true; shade=2; break; }
      }
      const fisheye = Math.cos(screen * fov);
      const d = Math.max(0.0001, dist * fisheye);
      const colH = Math.min(H, (H / (d*1.2))|0);
      const y0 = ((H - colH) / 2)|0;
      if (hitEnemy){
        ctx.fillStyle = '#ef5350';
        ctx.fillRect(i, y0, 1, colH);
      } else if (hitWall){
        ctx.fillStyle = this.opts.wallShade[shade] || '#3b437a';
        ctx.fillRect(i, y0, 1, colH);
      }
    }

    // Crosshair
    ctx.strokeStyle = '#e0e6ff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(W/2-6, H/2); ctx.lineTo(W/2+6, H/2); ctx.moveTo(W/2, H/2-6); ctx.lineTo(W/2, H/2+6); ctx.stroke(); ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(`FPV: ${viewTankId===0?'Red':'Cyan'}  Tick ${state.tick}  HP ${tank.hp}`, 8, 16);
  }
}

