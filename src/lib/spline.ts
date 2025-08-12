import type { Vec2 } from './types';

export function catmullRomSpline(points: Vec2[], samples = 600): Vec2[] {
  if (points.length < 2) return points;
  const pts = [points[0], ...points, points[points.length - 1]];
  const out: Vec2[] = [];
  for (let i = 0; i < pts.length - 3; i++) {
    const p0 = pts[i], p1 = pts[i+1], p2 = pts[i+2], p3 = pts[i+3];
    const segSamples = Math.max(8, Math.floor(samples / (pts.length - 3)));
    for (let j = 0; j < segSamples; j++) {
      const t = j / segSamples;
      const t2 = t*t, t3 = t2*t;
      const x = 0.5 * ((2*p1.x) + (-p0.x + p2.x)*t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3);
      const y = 0.5 * ((2*p1.y) + (-p0.y + p2.y)*t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3);
      out.push({ x, y });
    }
  }
  return out;
}

export function buildArcLengthTable(path: Vec2[]) {
  const acc: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i-1].x;
    const dy = path[i].y - path[i-1].y;
    acc.push(acc[i-1] + Math.hypot(dx, dy));
  }
  const total = acc[acc.length-1] || 1;
  return { acc, total };
}

export function samplePath(path: Vec2[], table: {acc:number[], total:number}, t: number): Vec2 {
  const s = t * table.total;
  let i = 0;
  while (i < table.acc.length - 1 && table.acc[i+1] < s) i++;
  const a = path[i], b = path[i+1] ?? a;
  const seg = table.acc[i+1] - table.acc[i] || 1;
  const lt = (s - table.acc[i]) / seg;
  return { x: a.x + (b.x - a.x) * lt, y: a.y + (b.y - a.y) * lt };
}
