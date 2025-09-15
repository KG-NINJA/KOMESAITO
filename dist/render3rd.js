// #KGNINJA - Third-Person (chase camera) renderer using simple raycasting

function angleForDir(dir){ return [-Math.PI/2, 0, Math.PI/2, Math.PI][dir]; }
function lerp(a,b,t){ return a + (b - a) * t; }

export class Renderer3rd {
  constructor(canvas, opts){
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas 2D not available');
    this.canvas = canvas; this.ctx = ctx;
    this.opts = Object.assign({ fovDeg: 70, maxDepth: 20, step: 0.02, wallShade: ['#4b548f', '#3b437a', '#2b335f'] }, opts||{});
    this.shakeUntil = 0;
  }

  project(state, camX, camY, camAng){
    const { canvas } = this; const W = canvas.width; const fov = (this.opts.fovDeg*Math.PI)/180;
    return (wx, wy) => {
      const dx = wx - camX, dy = wy - camY;
      const ang = Math.atan2(dy, dx) - camAng;
      // normalize to [-PI, PI]
      let a = ang; while (a > Math.PI) a -= Math.PI*2; while (a < -Math.PI) a += Math.PI*2;
      const sx = (a / fov + 0.5) * W; // screen x in pixels
      return sx;
    };
  }

  draw(state, prev, alpha, effects, viewTankId=0){
    const { ctx, canvas } = this; const W = canvas.width, H = canvas.height;
    // background
    ctx.fillStyle = '#0b102a'; ctx.fillRect(0,0,W,H/2);
    ctx.fillStyle = '#0a0d20'; ctx.fillRect(0,H/2,W,H/2);

    const t = state.tanks[viewTankId]; if (!t || t.hp<=0) return;
    const pt = prev && prev.tanks ? prev.tanks.find(p=>p.id===t.id) : null;
    const cxTank = pt ? lerp(pt.x+0.5, t.x+0.5, alpha??1) : (t.x+0.5);
    const cyTank = pt ? lerp(pt.y+0.5, t.y+0.5, alpha??1) : (t.y+0.5);
    const pa = pt ? angleForDir(pt.dir) : angleForDir(t.dir);
    const ca = angleForDir(t.dir);
    let da = ca - pa; while(da>Math.PI) da -= Math.PI*2; while(da<-Math.PI) da += Math.PI*2;
    const dirAng = pa + (alpha??1)*da;

    // camera a bit behind and above the tank
    const back = 0.7; // behind distance in grid cells
    const camX = cxTank - Math.cos(dirAng)*back;
    const camY = cyTank - Math.sin(dirAng)*back;
    const camAng = dirAng; // look forward along tank direction
    const fov = (this.opts.fovDeg*Math.PI)/180;
    const step = this.opts.step, maxDepth = this.opts.maxDepth;

    // Raycast walls and enemies
    function tileAt(x,y){ if (x<0||y<0||x>=state.width||y>=state.height) return 'wall'; return state.grid[y|0][x|0]; }
    function enemyAt(x,y){ for(const et of state.tanks){ if (et.hp>0 && et.id!==t.id && (et.x|0)===(x|0) && (et.y|0)===(y|0)) return et; } return null; }

    const rays = W; // 1 column per pixel
    for (let i=0;i<rays;i++){
      const screen = (i/(rays-1)) - 0.5;
      const ang = camAng + screen * fov;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      let sx=camX, sy=camY; let dist=0, shade=0; let hitWall=false, hitEnemy=false;
      for (let steps=0; steps<maxDepth/step; steps++){
        sx += dx*step; sy += dy*step; dist += step;
        if (enemyAt(sx,sy)) { hitEnemy=true; break; }
        const tile = tileAt(sx,sy);
        if (tile==='wall') { hitWall=true; shade = Math.min(2, (dist>6)?2:(dist>3)?1:0); break; }
      }
      const fisheye = Math.cos(screen*fov);
      const d = Math.max(0.0001, dist*fisheye);
      const colH = Math.min(H, (H/(d*1.2))|0);
      const y0 = ((H - colH)/2)|0;
      if (hitEnemy){ ctx.fillStyle = '#ef6c00'; ctx.fillRect(i, y0, 1, colH); }
      else if (hitWall){ ctx.fillStyle = this.opts.wallShade[shade] || '#3b437a'; ctx.fillRect(i, y0, 1, colH); }
    }

    // player presence cube disabled per request

    // Draw own tank as overlay silhouette (triangular), anchored bottom center
    const baseY = H - 28, baseX = W/2;
    const bodyW = 46, bodyH = 26; const nose = 22;
    ctx.fillStyle = viewTankId===0 ? '#ef5350' : '#26c6da'; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(baseX, baseY - nose);
    ctx.lineTo(baseX - bodyW/2, baseY + bodyH/2);
    ctx.lineTo(baseX + bodyW/2, baseY + bodyH/2);
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    // Barrel
    ctx.strokeStyle = '#e0e6ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(baseX, baseY - 8); ctx.lineTo(baseX, baseY - nose - 8); ctx.stroke();

    // Impact markers from effects (explosion)
    const projX = this.project(state, camX, camY, camAng);
    if (effects && effects.length){
      const now = performance.now();
      for (const e of effects){ if (e.type !== 'explosion') continue; const t = Math.max(0, Math.min(1, (now - e.start)/e.life)); const sx = projX(e.x+0.5, e.y+0.5);
        const radius = 24 + 40*(1-t); const alphaI = 1 - t;
        ctx.strokeStyle = `rgba(255,180,60,${alphaI})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, H/2, radius, 0, Math.PI*2); ctx.stroke();
        // Vertical highlight band
        ctx.fillStyle = `rgba(255,220,120,${0.25*alphaI})`; ctx.fillRect((sx|0)-2, 0, 4, H);
        // Screen shake for near impacts
        this.shakeUntil = Math.max(this.shakeUntil, now + 120);
      }
    }

    // Crosshair
    ctx.strokeStyle = '#e0e6ff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(W/2-6, H/2); ctx.lineTo(W/2+6, H/2); ctx.moveTo(W/2, H/2-6); ctx.lineTo(W/2, H/2+6); ctx.stroke(); ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(`TPV: ${viewTankId===0?'Red':'Cyan'}  Tick ${state.tick}  HP ${t.hp}`, 8, 16);
  }
}
