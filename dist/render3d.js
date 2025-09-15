// #KGNINJA - Simple isometric polygon renderer
import { dirVec } from './engine.js';

export class Renderer3D {
  constructor(canvas, opts){
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not available');
    this.canvas = canvas; this.ctx = ctx;
    this.opts = Object.assign({ cell: 16, originX: canvas.width/2, originY: 80 }, opts||{});
  }
  iso(x, y, z){
    const s = this.opts.cell;
    const ix = this.opts.originX + (x - y) * s;
    const iy = this.opts.originY + (x + y) * s * 0.5 - z;
    return [ix, iy];
  }
  poly(points, fill, stroke){ const {ctx}=this; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0], points[i][1]); ctx.closePath(); if (fill){ ctx.fillStyle = fill; ctx.fill(); } if (stroke){ ctx.strokeStyle = stroke; ctx.stroke(); } }
  clear(){ const {ctx,canvas}=this; ctx.clearRect(0,0,canvas.width,canvas.height); }
  drawFloor(st){ const {ctx} = this; const s = this.opts.cell; ctx.strokeStyle = 'rgba(120,140,200,0.15)'; ctx.lineWidth = 1;
    for (let x=0;x<=st.width;x++){ const a=this.iso(x,0,0), b=this.iso(x,st.height,0); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); }
    for (let y=0;y<=st.height;y++){ const a=this.iso(0,y,0), b=this.iso(st.width,y,0); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); }
  }
  drawWalls(st){ const h = this.opts.cell*0.9; for (let y=0;y<st.height;y++){ for(let x=0;x<st.width;x++){ if (st.grid[y][x] !== 'wall') continue; const top=[ this.iso(x,y,h), this.iso(x+1,y,h), this.iso(x+1,y+1,h), this.iso(x,y+1,h) ]; const left=[ this.iso(x,y,0), this.iso(x,y,h), this.iso(x,y+1,h), this.iso(x,y+1,0) ]; const right=[ this.iso(x+1,y,0), this.iso(x+1,y,h), this.iso(x+1,y+1,h), this.iso(x+1,y+1,0) ]; this.poly(right,'#313a79'); this.poly(left,'#262f61'); this.poly(top,'#48519a'); } } }
  drawTank(t, prev, alpha, color){ const h = this.opts.cell*0.8; const cx = t.x+0.5, cy=t.y+0.5; const pdir = prev? prev.dir : t.dir; const pa = [-Math.PI/2,0,Math.PI/2,Math.PI][pdir]; const ca = [-Math.PI/2,0,Math.PI/2,Math.PI][t.dir]; let da = ca-pa; while(da>Math.PI) da-=Math.PI*2; while(da<-Math.PI) da+=Math.PI*2; const ang = pa + da*alpha; const r = 0.45; const p0=[cx + Math.cos(ang)*r, cy + Math.sin(ang)*r]; const p1=[cx + Math.cos(ang+2.5)*r, cy + Math.sin(ang+2.5)*r]; const p2=[cx + Math.cos(ang-2.5)*r, cy + Math.sin(ang-2.5)*r]; const top=[ this.iso(p0[0],p0[1],h), this.iso(p1[0],p1[1],h), this.iso(p2[0],p2[1],h) ]; this.poly(top, color);
    // shadow
    const sh=[ this.iso(p0[0],p0[1],0), this.iso(p1[0],p1[1],0), this.iso(p2[0],p2[1],0) ]; this.poly(sh,'rgba(0,0,0,0.15)');
  }
  drawBullets(st, alpha){ const s=this.opts.cell; const r = s*0.15; const {ctx}=this; ctx.fillStyle = '#ffd54f'; for (const b of st.bullets){ const [dx,dy]=dirVec(b.dir); const fx=b.x - dx*(1-alpha) + 0.5; const fy=b.y - dy*(1-alpha) + 0.5; const p=this.iso(fx,fy,s*0.4); ctx.beginPath(); ctx.moveTo(p[0],p[1]-r); ctx.lineTo(p[0]+r,p[1]); ctx.lineTo(p[0],p[1]+r); ctx.lineTo(p[0]-r,p[1]); ctx.closePath(); ctx.fill(); } }
  drawEffects(effects){ const {ctx}=this; for(const e of effects){ const now=performance.now(); const t=Math.max(0,Math.min(1,(now-e.start)/e.life)); if(e.type==='explosion'){ const p=this.iso(e.x+0.5,e.y+0.5,this.opts.cell*0.4); const R=this.opts.cell*(0.1+0.25*t); ctx.fillStyle=`rgba(255,120,60,${1-t})`; ctx.beginPath(); for(let i=0;i<8;i++){ const a=(i/8)*Math.PI*2; const rr = i%2===0? R : R*0.5; const x=p[0]+Math.cos(a)*rr, y=p[1]+Math.sin(a)*rr; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.closePath(); ctx.fill(); } }
  }
  draw(st, prev, alpha, effects){ this.clear(); this.drawFloor(st); this.drawWalls(st); const colors=['#ef5350','#26c6da']; for (const t of st.tanks){ if (t.hp<=0) continue; const pt = prev && prev.tanks ? prev.tanks.find(p=>p.id===t.id) : null; this.drawTank(t, pt, alpha??1, colors[t.id]||'#90caf9'); } this.drawBullets(st, alpha??1); if (effects && effects.length) this.drawEffects(effects); }
}

