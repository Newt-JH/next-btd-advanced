'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_W, CANVAS_H, COLORS, GRID_W, GRID_H, START_CASH, START_LIVES, SHOP, TILE, UPGRADE_COST_BASE, SELL_RATIO, ROUND_PLAN, TOTAL_ROUNDS, GRADE_THRESHOLDS } from '@/lib/constants';
import { Enemy, GameState, Projectile, ShopItem, Tower, TowerKind } from '@/lib/types';
import { catmullRomSpline, buildArcLengthTable, samplePath } from '@/lib/spline';
import { clamp, dist, snapToTile, tileToPx } from '@/lib/utils';
import { SVG_BOMB_ICON, SVG_SCOPE_ICON, SVG_SNOW_ICON, SVG_TOWER_BASE, SVG_TOWER_BARREL, makePath2D } from '@/lib/assets';

const CONTROL_TILES = [
  { x: 0, y: 2 }, { x: 3, y: 2 }, { x: 5, y: 6 }, { x: 8, y: 7 },
  { x: 11, y: 3 }, { x: 14, y: 4 }, { x: 15.5, y: 4.5 }
];
const CONTROL_POINTS = CONTROL_TILES.map(tileToPx);
const PATH_POINTS = catmullRomSpline(CONTROL_POINTS, 900);
const ARC_TABLE = buildArcLengthTable(PATH_POINTS);

function isOnPathTile(tile:{x:number;y:number}): boolean {
  const center = { x: tile.x*TILE+TILE/2, y: tile.y*TILE+TILE/2 };
  const r = TILE*0.45;
  for (let i=1;i<PATH_POINTS.length;i+=6){
    const a=PATH_POINTS[i-1], b=PATH_POINTS[i];
    const abx = b.x-a.x, aby=b.y-a.y;
    const apx = center.x-a.x, apy=center.y-a.y;
    const ab2 = abx*abx+aby*aby || 1;
    const t = clamp((apx*abx+apy*aby)/ab2,0,1);
    const proj = { x: a.x+abx*t, y: a.y+aby*t };
    if (dist(center, proj) < r) return true;
  }
  return false;
}

function calcGrade(score: number): 'S'|'A'|'B'|'C'|'D' {
    for (const g of GRADE_THRESHOLDS) if (score >= g.min) return g.grade;
    return 'D';
  }

function makeEnemyByTier(id:number, tier: Enemy['tier']): Enemy {
  const stats = {
    RED:    { hp: 30,  spd: 80,  reward: 5,  immuneSlow: false },
    BLUE:   { hp: 45,  spd: 90,  reward: 6,  immuneSlow: false },
    GREEN:  { hp: 70,  spd: 100,  reward: 7,  immuneSlow: false },
    YELLOW: { hp: 110, spd: 110,  reward: 8,  immuneSlow: true  },
    PINK:   { hp: 160, spd: 120, reward: 10, immuneSlow: true  },
  }[tier];

  
  return {
    id,
    pos: { ...PATH_POINTS[0] },
    baseSpeed: stats.spd,
    speed: stats.spd,
    hp: stats.hp,
    maxHp: stats.hp,
    radius: 16,
    pathT: 0,
    reward: stats.reward,
    tier,
    immuneSlow: stats.immuneSlow,
  };
}

function makeTowerByKind(id:number, kind: TowerKind, tile:{x:number;y:number}): Tower {
  const base = {
    id, kind, tile, pos: tileToPx(tile), level: 1, sellRatio: SELL_RATIO, cooldown: 0
  } as Partial<Tower>;
  switch(kind){
    case 'DART':   return { ...base, range: 170, fireRate: 1.6, projectileSpeed: 320, damage: 16 } as Tower;
    case 'BOMB':   return { ...base, range: 150, fireRate: 0.9, projectileSpeed: 260, damage: 20, aoeRadius: 64 } as Tower;
    case 'ICE':    return { ...base, range: 140, fireRate: 0.8, projectileSpeed: 220, damage: 8,  slowPct: 0.35, slowDuration: 1.8 } as Tower;
    case 'SNIPER': return { ...base, range: 9999, fireRate: 0.7, projectileSpeed: 9999, damage: 48 } as Tower;
  }
}

function applyUpgrade(t: Tower): Tower {
  const n: Tower = { ...t, level: t.level+1 };
  switch(t.kind){
    case 'DART':   n.damage = Math.round(t.damage * 1.22); n.fireRate = +(t.fireRate * 1.1).toFixed(2); n.range = t.range + 10; break;
    case 'BOMB':   n.damage = Math.round(t.damage * 1.25); n.aoeRadius = (t.aoeRadius ?? 60) + 6; n.fireRate = +(t.fireRate * 1.05).toFixed(2); break;
    case 'ICE':    n.slowPct = clamp((t.slowPct ?? 0.3) + 0.05, 0, 0.7); n.slowDuration = (t.slowDuration ?? 1.2) + 0.2; n.range = t.range + 8; break;
    case 'SNIPER': n.damage = Math.round(t.damage * 1.3); n.fireRate = +(t.fireRate * 1.08).toFixed(2); break;
  }
  return n;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shopSel, setShopSel] = useState<ShopItem>(SHOP[0]);
  const shopSelRef = useRef<ShopItem>(SHOP[0]);
  useEffect(() => {
    shopSelRef.current = shopSel;
  }, [shopSel]);
  const [hud, setHud] = useState({ cash: START_CASH, lives: START_LIVES, round: 1, inCombat: false });
  const stateRef = useRef<GameState>({
    enemies: [], towers: [], projectiles: [],
    cash: START_CASH, lives: START_LIVES, round: 1, inCombat: false,
    selectedTowerId: undefined, hoveredTile: null,
    nextEnemyId: 1, nextTowerId: 1, nextProjId: 1,
    _spawnSchedule: [],
    score: 0, gameOver: false, gameResult: undefined, grade: undefined,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const onResize = () => {
      const w = containerRef.current?.clientWidth ?? CANVAS_W;
      setScale(Math.min(1, w / (CANVAS_W + 280)));
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current!;
    const rectOf = () => cvs.getBoundingClientRect();
    const onMove = (e: MouseEvent) => {
      const r = rectOf();
      const pxPos = { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
      const tile = snapToTile(pxPos);
      stateRef.current.hoveredTile = tile;
    };
    const onClick = (e: MouseEvent) => {
      const r = rectOf();
      const pxPos = { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
      const tile = snapToTile(pxPos);
      onCanvasClick(tile);
    };
    cvs.addEventListener('mousemove', onMove);
    cvs.addEventListener('click', onClick);
    return () => {
      cvs.removeEventListener('mousemove', onMove);
      cvs.removeEventListener('click', onClick);
    };
  }, [scale]);

  useEffect(() => {
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext('2d')!;
    let last = performance.now();
    let raf = 0;

    const loop = (t: number) => {
      const dt = (t - last) / 1000; last = t;
      step(stateRef.current, dt);
      draw(ctx, stateRef.current, scale);
      if (Math.floor(t/100) !== Math.floor((t-dt*1000)/100)) {
        const s = stateRef.current;
        setHud({ cash: s.cash, lives: s.lives, round: s.round, inCombat: s.inCombat });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scale]);

  const startRound = () => {
    const s = stateRef.current;
    if (s.inCombat || s.gameOver || s.round > TOTAL_ROUNDS) return;
    spawnWave(s);
  };

  const onCanvasClick = (tile: { x: number; y: number }) => {
    const s = stateRef.current;
    const clicked = s.towers.find(t => t.tile.x === tile.x && t.tile.y === tile.y);
    if (clicked) {
      s.selectedTowerId = clicked.id;
      return;
    }
    if (isOnPathTile(tile)) return;
    if (s.inCombat) return;
    if (s.towers.some(t => t.tile.x === tile.x && t.tile.y === tile.y)) return;
  
    const selectedItem = shopSelRef.current; // ✅ ref 사용
    const cost = selectedItem.cost;
    if (s.cash < cost) return;
  
    const tower = makeTowerByKind(s.nextTowerId++, selectedItem.kind, tile);
    s.towers.push(tower);
    s.cash -= cost;
    s.selectedTowerId = tower.id;
  };

  const selectedTower = useMemo(() => {
    const id = stateRef.current.selectedTowerId;
    return stateRef.current.towers.find(t => t.id === id);
  }, [hud, shopSel]);

  const upgradeCost = (t: Tower) => Math.round(shopPrice(t.kind) * Math.pow(UPGRADE_COST_BASE, t.level-1));
  const shopPrice = (kind: TowerKind) => SHOP.find(s => s.kind===kind)!.cost;
  const doUpgrade = () => {
    const s = stateRef.current;
    const t = s.towers.find(x => x.id === s.selectedTowerId);
    if (!t) return;
    const cost = upgradeCost(t);
    if (s.cash < cost) return;
    const nt = applyUpgrade(t);
    s.cash -= cost;
    Object.assign(t, nt);
  };
  const doSell = () => {
    const s = stateRef.current;
    const idx = s.towers.findIndex(x => x.id === s.selectedTowerId);
    if (idx < 0) return;
    const t = s.towers[idx];
    const base = shopPrice(t.kind);
    const upgrades = Array.from({ length: Math.max(0, t.level - 1) }, (_, i) =>
      Math.round(base * Math.pow(UPGRADE_COST_BASE, i))
    ).reduce((sum: number, v) => sum + v, 0);
    const paid = base + upgrades;
    const refund = Math.round(paid * SELL_RATIO);
    s.cash += refund;
    s.towers.splice(idx,1);
    s.selectedTowerId = undefined;
  };
    
  const resetGame = () => {
    const s = stateRef.current;
    s.enemies = []; s.towers = []; s.projectiles = [];
    s.cash = START_CASH; s.lives = START_LIVES; s.round = 1;
    s.inCombat = false; s.selectedTowerId = undefined;
    s._spawnSchedule = [];
    s.score = 0; s.gameOver = false; s.gameResult = undefined; s.grade = undefined;
  };

  return (
    <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12, alignItems: 'start', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      {/* 좌측 패널 */}
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12, padding: 12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 8 }}>
          <strong>라운드 {hud.round}</strong>
          <span>💰 {hud.cash} • ❤️ {hud.lives}</span>
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.85 }}>
  점수: {stateRef.current.score}
</div>
<button
  onClick={startRound}
  disabled={hud.inCombat || stateRef.current.gameOver || stateRef.current.round > TOTAL_ROUNDS}
  style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:`1px solid ${COLORS.panelBorder}`, background: (hud.inCombat || stateRef.current.round > TOTAL_ROUNDS) ? '#1f2937' : '#1b2a45', color: COLORS.text }}
>
  {hud.inCombat
    ? '전투 중...'
    : (stateRef.current.round > TOTAL_ROUNDS ? '모든 라운드 완료' : '라운드 시작')}
</button>
        {/* 상점 */}
        <h3 style={{ margin: '12px 0 6px', fontSize: 14 }}>상점</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {SHOP.map(item => (
            <button key={item.kind} onClick={()=>setShopSel(item)} style={{ textAlign:'left', padding:10, borderRadius:10, border:`1px solid ${shopSel.kind===item.kind ? '#415a8b' : COLORS.panelBorder}`, background: shopSel.kind===item.kind ? '#15223b' : '#0f172a', color: COLORS.text }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>{item.name}</span>
                <span>💰{item.cost}</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{item.desc}</div>
            </button>
          ))}
        </div>
        {/* 선택 타워 */}
        <h3 style={{ margin: '12px 0 6px', fontSize: 14 }}>선택 타워</h3>
        {selectedTower ? (
          <div style={{ border: `1px solid ${COLORS.panelBorder}`, borderRadius: 10, padding: 10 }}>
            <div style={{ marginBottom:6 }}>
              <strong>{selectedTower.kind} Lv.{selectedTower.level}</strong>
            </div>
            <div style={{ fontSize: 12, opacity:0.85 }}>공격력 {selectedTower.damage} • 공속 {selectedTower.fireRate.toFixed(2)}/s</div>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={doUpgrade} style={{ flex:1, padding:'8px 10px', borderRadius:8, border:`1px solid ${COLORS.panelBorder}`, background:'#162235', color: COLORS.text, fontSize: 13 }}>업그레이드 (💰{upgradeCost(selectedTower)})</button>
              <button onClick={doSell} style={{ flex:1, padding:'8px 10px', borderRadius:8, border:`1px solid ${COLORS.panelBorder}`, background:'#3a1f2a', color: COLORS.text, fontSize: 13 }}>판매</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>타워를 선택하세요.</div>
        )}
      </div>
      {/* 게임 캔버스 */}
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ width: CANVAS_W, height: CANVAS_H, background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12 }} />
          {stateRef.current.gameOver && (
  <div style={{
    position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
    display:'flex', alignItems:'center', justifyContent:'center', zIndex:50
  }}>
    <div style={{
      width:380, background:'#0f172a', border:`1px solid ${COLORS.panelBorder}`,
      borderRadius:12, padding:16, color:COLORS.text, boxShadow:'0 10px 40px rgba(0,0,0,0.5)'
    }}>
      <h2 style={{margin:'0 0 8px'}}>
        {stateRef.current.gameResult === 'CLEAR' ? 'Game Clear' : 'Game Over'}
      </h2>
      <div style={{opacity:0.9, marginBottom:12, lineHeight:1.6}}>
        점수: <strong>{stateRef.current.score}</strong><br/>
        등급: <strong style={{fontSize:18}}>{stateRef.current.grade}</strong>
      </div>
      <button onClick={resetGame} style={{
        width:'100%', padding:'10px 12px', borderRadius:10,
        border:`1px solid ${COLORS.panelBorder}`, background:'#1b2a45',
        color:COLORS.text, cursor:'pointer'
      }}>
        다시 하기
      </button>
    </div>
  </div>
)}
      </div>
  );
}

// ------------ 웨이브 스폰 ------------
function spawnWave(s: GameState) {
  if (s.round > TOTAL_ROUNDS) return;

  const plan = ROUND_PLAN[s.round - 1];
  s.inCombat = true;

  const startTime = performance.now();
  const schedule: { at: number; enemy: Enemy }[] = [];
  let spawnTime = startTime;

  // ✅ 라운드 내 여러 웨이브를 순차 스케줄링
  for (const wave of plan.waves) {
    for (let i = 0; i < wave.count; i++) {
      const enemy = makeEnemyByTier(s.nextEnemyId++, wave.tier);
      schedule.push({ at: spawnTime, enemy });
      spawnTime += wave.gap * 1000; // 개별 gap 적용
    }
  }

  s._spawnSchedule = schedule;
}
  
  // ------------ 시뮬레이션 스텝 ------------
  function step(s: GameState, dt: number) {
    const now = performance.now();
    const toRemove: number[] = [];

    // 스폰 처리
    const sch: { at: number; enemy: Enemy }[] = s._spawnSchedule || [];
    while (sch.length && sch[0].at <= now) {
      const item = sch.shift()!;
      s.enemies.push(item.enemy);
    }
    
    s._spawnSchedule = sch;
  
    // 적 이동 (스플라인 pathT 증가)
    for (const e of s.enemies) {
      // 슬로우 만료
      if (e.slowUntil && now > e.slowUntil) {
        e.slowUntil = undefined;
        e.slowFactor = undefined;
        e.speed = e.baseSpeed;
      }
      const deltaT = (e.speed * dt) / ARC_TABLE.total;
      e.pathT += deltaT;
      const tClamped = Math.min(0.9999, e.pathT);
      const p = samplePath(PATH_POINTS, ARC_TABLE, tClamped);
      e.pos.x = p.x;
      e.pos.y = p.y;
  
    if (e.pathT >= 1) {
      s.lives -= 1;
      toRemove.push(e.id);

      if (s.lives <= 0 && !s.gameOver) {
        s.inCombat = false;
        s._spawnSchedule = [];
        s.gameOver = true;
        s.gameResult = 'OVER';
        s.grade = calcGrade(s.score);
        return;
      }
    }
    }
    if (toRemove.length) {
      s.enemies = s.enemies.filter(en => !toRemove.includes(en.id));
    }
    // 타워 사격
    for (const t of s.towers) {
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
  
      const targets = s.enemies.filter(
        (e) => e.hp > 0 && (t.kind === 'SNIPER' || dist(t.pos, e.pos) <= t.range)
      );
      if (!targets.length) continue;
  
      // 우선순위: 더 앞선 적(pathT 큰 순) → 거리 짧은 순
      targets.sort(
        (a, b) => b.pathT - a.pathT || dist(t.pos, a.pos) - dist(t.pos, b.pos)
      );
      const target = targets[0];
  
      // 발사체 생성
      const proj: Projectile = {
        id: s.nextProjId++,
        kind:
          t.kind === 'BOMB'
            ? 'AOE'
            : t.kind === 'ICE'
            ? 'SLOW'
            : t.kind === 'SNIPER'
            ? 'SNIPER'
            : 'SINGLE',
        pos: { ...t.pos },
        targetId: target.id,
        speed: t.projectileSpeed,
        damage: t.damage,
        alive: true,
        aoeRadius: t.aoeRadius,
        slowPct: t.slowPct,
        slowDuration: t.slowDuration,
      };
      s.projectiles.push(proj);
      t.cooldown = 1 / t.fireRate;
    }
  
    // 투사체 이동 & 충돌
    for (const p of s.projectiles) {
      if (!p.alive) continue;
  
      if (p.kind === 'SNIPER') {
        // 즉시 타격
        const target = s.enemies.find((e) => e.id === p.targetId && e.hp > 0);
        if (target) {
          target.hp -= p.damage;
          if (target.hp <= 0) s.cash += target.reward;
        }
        p.alive = false;
        continue;
      }
  
      const target = s.enemies.find((e) => e.id === p.targetId && e.hp > 0);
      if (!target) {
        p.alive = false;
        continue;
      }
  
      const dx = target.pos.x - p.pos.x;
      const dy = target.pos.y - p.pos.y;
      const len = Math.hypot(dx, dy);
  
      if (len < target.radius + 4) {
        // 히트 처리
        if (p.kind === 'AOE') {
          for (const e of s.enemies) {
            if (e.hp <= 0) continue;
            if (dist(e.pos, target.pos) <= (p.aoeRadius ?? 60)) {
              e.hp -= p.damage;
              if (e.hp <= 0) s.cash += e.reward;
            }
          }
        } else if (p.kind === 'SLOW') {
          if (!target.immuneSlow) {
            target.hp -= p.damage;
            if (target.hp <= 0) s.cash += target.reward;
            else {
              const factor = 1 - (p.slowPct ?? 0.3);
              target.slowFactor = factor;
              target.speed = target.baseSpeed * factor;
              target.slowUntil =
                performance.now() + (p.slowDuration ?? 1.5) * 1000;
            }
          } else {
            // 면역이면 데미지만
            target.hp -= p.damage;
            if (target.hp <= 0) s.cash += target.reward;
          }
        } else {
          target.hp -= p.damage;
          if (target.hp <= 0) s.cash += target.reward;
        }
        p.alive = false;
      } else {
        // 추적 이동
        p.pos.x += (dx / len) * p.speed * dt;
        p.pos.y += (dy / len) * p.speed * dt;
      }
    }
  
    // 정리
    s.projectiles = s.projectiles.filter((p) => p.alive);
    s.enemies = s.enemies.filter((e) => e.hp > 0);
  
    // 라운드 종료 판정
    const noIncoming = (s._spawnSchedule?.length ?? 0) === 0;
    if (!s.gameOver && s.inCombat && noIncoming && s.enemies.length === 0) {
    s.inCombat = false;

    // ✅ 라운드 성공 보상: 라운드 * 10
    s.cash += s.round * 10;

    // ✅ 마지막 라운드면 게임 클리어 모달
    if (s.round >= TOTAL_ROUNDS) {
        s.gameOver = true;
        s.gameResult = 'CLEAR';
        s.grade = calcGrade(s.score); // 누적 점수로 등급 산정
        return;
    }

    // 다음 라운드로 진행
    s.round += 1;
    }
  }
  
  // ------------ 렌더링 ------------
  function draw(
    ctx: CanvasRenderingContext2D,
    s: GameState,
    scale: number,
  ) {
    const W = CANVAS_W;
    const H = CANVAS_H;
  
    // 1️⃣ 스케일 적용 전에 전체 지우기
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
  
    // 2️⃣ 다시 스케일 적용
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  
    // 배경 + 그리드
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  
    // 경로
    ctx.lineCap = 'round';
    ctx.lineWidth = TILE * 0.8;
    ctx.strokeStyle = COLORS.path;
    ctx.beginPath();
    ctx.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i++) ctx.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    ctx.stroke();
  
    // 호버 타일
    if (s.hoveredTile) {
      const { x, y } = s.hoveredTile;
      ctx.fillStyle = 'rgba(148,163,184,0.12)';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  
    // 타워
    for (const t of s.towers) drawTower(ctx, t);
  
    // 적
    for (const e of s.enemies) drawEnemy(ctx, e);
  
    // 투사체
    for (const p of s.projectiles) {
      ctx.fillStyle =
        p.kind === 'AOE' ? COLORS.bomb : p.kind === 'SLOW' ? COLORS.ice : COLORS.dart;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  
    // HUD
    ctx.fillStyle = '#9aa5b1';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Enemies: ${s.enemies.length}`, W - 8, 16);
  }
  
  function drawTower(ctx: CanvasRenderingContext2D, t: Tower) {
    ctx.save();
    ctx.translate(t.pos.x, t.pos.y);
  
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  
    // 색상
    const baseColor =
      t.kind === 'DART'
        ? COLORS.dart
        : t.kind === 'BOMB'
        ? COLORS.bomb
        : t.kind === 'ICE'
        ? COLORS.ice
        : COLORS.sniper;
  
    // 사거리
    ctx.fillStyle = `${baseColor}22`;
    ctx.beginPath();
    ctx.arc(0, 0, t.range, 0, Math.PI * 2);
    ctx.fill();
  
    // 본체
    const basePath = makePath2D(SVG_TOWER_BASE);
    const barrel = makePath2D(SVG_TOWER_BARREL);
    const g = ctx.createLinearGradient(-14, -10, 14, 10);
    g.addColorStop(0, baseColor + 'cc');
    g.addColorStop(1, '#ffffff22');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#0b0f1a';
    ctx.lineWidth = 1.2;
    ctx.fill(basePath);
    ctx.stroke(basePath);
  
    ctx.fillStyle = baseColor;
    ctx.fill(barrel);
    ctx.strokeStyle = '#0b0f1a';
    ctx.stroke(barrel);
  
    // 아이콘
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2;
    if (t.kind === 'BOMB') ctx.stroke(makePath2D(SVG_BOMB_ICON));
    else if (t.kind === 'ICE') ctx.stroke(makePath2D(SVG_SNOW_ICON));
    else if (t.kind === 'SNIPER') ctx.stroke(makePath2D(SVG_SCOPE_ICON));
  
    ctx.restore();
  }
  
function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  if (e.hp <= 0 || e.pathT >= 1) return;
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);
  
    // 몸체(풍선 느낌)
    const fill = COLORS.enemy[e.tier];
    const r = e.radius;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff6');
    g.addColorStop(1, fill);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 1.1, 0, 0, Math.PI * 2); // ✅ 7개 이상
    ctx.fill();
  
    // 하이라이트/꼬리
    ctx.strokeStyle = '#ffffff55';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.25, r * 0.6, -0.2, 1.1);
    ctx.stroke();
  
    ctx.strokeStyle = fill;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.lineTo(0, r * 1.3);
    ctx.stroke();
  
    // HP bar
    const w = 28,
      h = 5;
    ctx.fillStyle = '#0b0f1a';
    ctx.fillRect(-w / 2, -r - 12, w, h);
    ctx.fillStyle = '#22c55e';
    const hpw = w * clamp(e.hp, 0, e.maxHp) / e.maxHp;
    ctx.fillRect(-w / 2, -r - 12, hpw, h);
  
    // 슬로우 면역 표시
    if (e.immuneSlow) {
      ctx.fillStyle = '#93c5fd';
      ctx.font = '10px ui-monospace';
      ctx.textAlign = 'center';
      ctx.fillText('IMM', 0, -r - 16);
    }
  
    ctx.restore();
  }
  