export type Vec2 = { x: number; y: number };

export type EnemyTier = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW' | 'PINK';

export type Enemy = {
  id: number;
  pos: Vec2;
  speed: number;
  baseSpeed: number;
  hp: number;
  maxHp: number;
  radius: number;
  pathT: number;
  reward: number;
  tier: EnemyTier;
  immuneSlow?: boolean;
  slowUntil?: number;
  slowFactor?: number;
};

export type TowerKind = 'DART' | 'BOMB' | 'ICE' | 'SNIPER';

export type Tower = {
  id: number;
  kind: TowerKind;
  pos: Vec2;
  tile: { x: number; y: number };
  range: number;
  fireRate: number;
  cooldown: number;
  projectileSpeed: number;
  damage: number;
  level: number;
  sellRatio: number;
  aoeRadius?: number;
  slowPct?: number;
  slowDuration?: number;
};

export type Projectile = {
  id: number;
  kind: 'SINGLE' | 'AOE' | 'SLOW' | 'SNIPER';
  pos: Vec2;
  targetId?: number;
  dir?: Vec2;
  speed: number;
  damage: number;
  alive: boolean;
  aoeRadius?: number;
  slowPct?: number;
  slowDuration?: number;
};

export type ShopItem = {
  kind: TowerKind;
  name: string;
  cost: number;
  desc: string;
};

export type GameState = {
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  cash: number;
  lives: number;
  round: number;
  inCombat: boolean;
  selectedTowerId?: number;
  hoveredTile?: { x: number; y: number } | null;
  nextEnemyId: number;
  nextTowerId: number;
  nextProjId: number;
  _spawnSchedule?: { at: number; enemy: Enemy }[]; // 내부 스폰 큐
  score: number;                 // 라운드 성공시 누적
  gameOver: boolean;             // 모달 표시 여부
  gameResult?: GameResult;       // 'CLEAR' | 'OVER'
  grade?: 'S'|'A'|'B'|'C'|'D';   // 최종 등급
};

export type GameResult = 'CLEAR' | 'OVER';