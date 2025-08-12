// 풍선 티어 리터럴 (import 안 걸리게 로컬 정의)
export type EnemyTier = 'RED'|'BLUE'|'GREEN'|'YELLOW'|'PINK';

export const TILE = 56;
export const GRID_W = 16;
export const GRID_H = 10;
export const CANVAS_W = GRID_W * TILE;
export const CANVAS_H = GRID_H * TILE;

export const START_CASH = 200;
export const START_LIVES = 25;

export const COLORS = {
  bg: '#0b1020',
  grid: '#1b243a',
  path: '#3b4a6b',
  pathEdge: '#20314e',
  text: '#e5e7eb',
  panel: '#0f172a',
  panelBorder: '#1f2a44',
  good: '#22c55e',
  warn: '#f59e0b',
  bad: '#ef4444',
  dart: '#60a5fa',
  bomb: '#f59e0b',
  ice: '#38bdf8',
  sniper: '#a78bfa',
  enemy: {
    RED: '#ef4444',
    BLUE: '#60a5fa',
    GREEN: '#22c55e',
    YELLOW: '#facc15',
    PINK: '#f472b6'
  }
};

export const SHOP: import('./types').ShopItem[] = [
  { kind: 'DART',   name: '다트',   cost: 60,  desc: '기본 단일 타격. 저렴, 범용' },
  { kind: 'BOMB',   name: '폭탄',   cost: 100, desc: '광역 폭발. 방어도 무시 없음' },
  { kind: 'ICE',    name: '서리',   cost: 90,  desc: '광역 감속. 슬로우 면역 제외' },
  { kind: 'SNIPER', name: '저격',   cost: 120, desc: '맵 전역 사거리, 저속 고화력' },
];

export const UPGRADE_COST_BASE = 1.5;
export const SELL_RATIO = 0.7;

// 한 라운드에 여러 종류 풍선을 순차 스폰
export const ROUND_PLAN: {
  waves: { tier: EnemyTier; count: number; gap: number }[];
}[] = [
  // 1
  { waves: [ { tier: 'RED',   count: 10, gap: 0.30 } ] },
  // 2
  { waves: [ { tier: 'BLUE',  count: 12, gap: 0.40 } ] },
  // 3
  { waves: [
      { tier: 'RED',   count: 8,  gap: 0.30 },
      { tier: 'BLUE',  count: 8,  gap: 0.40 },
    ] },
  // 4
  { waves: [ { tier: 'GREEN', count: 14, gap: 0.70 } ] },
  // 5
  { waves: [
      { tier: 'BLUE',  count: 10, gap: 0.70 },
      { tier: 'GREEN', count: 10, gap: 0.50 },
    ] },
  // 6
  { waves: [ { tier: 'YELLOW',count: 14, gap: 0.60 } ] },
  // 7
  { waves: [
      { tier: 'GREEN', count: 10, gap: 0.60 },
      { tier: 'YELLOW',count: 10, gap: 0.58 },
    ] },
  // 8
  { waves: [ { tier: 'PINK',  count: 12, gap: 0.55 } ] },
  // 9
  { waves: [
      { tier: 'BLUE',  count: 8,  gap: 0.60 },
      { tier: 'GREEN', count: 8,  gap: 0.58 },
      { tier: 'YELLOW',count: 8,  gap: 0.56 },
    ] },
  // 10 (파이널)
  { waves: [
      { tier: 'YELLOW',count: 10, gap: 0.54 },
      { tier: 'PINK',  count: 18, gap: 0.50 },
    ] },
];

// 총 라운드 수 (ROUND_PLAN 길이 그대로 쓰려면 아래처럼)
export const TOTAL_ROUNDS = ROUND_PLAN.length;

// 등급 커트라인 (라운드보상만 기준: 1~10라운드 합계 550점)
// 필요하면 추후 조정
export const GRADE_THRESHOLDS: { min: number; grade: 'S'|'A'|'B'|'C'|'D' }[] = [
  { min: 520, grade: 'S' },
  { min: 460, grade: 'A' },
  { min: 360, grade: 'B' },
  { min: 220, grade: 'C' },
  { min: 0,   grade: 'D' },
];