import type { Vec2 } from './types';
import { TILE, GRID_W, GRID_H } from './constants';

export const clamp = (v:number, a:number, b:number) => Math.max(a, Math.min(b, v));
export const dist = (a:Vec2,b:Vec2) => Math.hypot(a.x-b.x, a.y-b.y);
export const lerp = (a:number,b:number,t:number)=>a+(b-a)*t;

export const tileToPx = (t: Vec2): Vec2 => ({ x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 });
export const snapToTile = (px: Vec2) => ({ x: clamp(Math.floor(px.x / TILE), 0, GRID_W-1), y: clamp(Math.floor(px.y / TILE), 0, GRID_H-1) });

export const withinCanvas = (p: Vec2) => p.x >= 0 && p.y >= 0 && p.x <= GRID_W*TILE && p.y <= GRID_H*TILE;
