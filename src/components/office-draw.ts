import type { PersonaId } from "@/lib/types";

// 哑渲染层（Kairosoft 经营游戏风）：一个有前台/订单看板/运输大屏/工位/陈设的货代办公室。
// 素材：Pixel Agents(MIT) + 派生瓦片(CC0) + Ninja Adventure(CC0)。全部 16px×4，按 naturalW/4 绘制。
// 只画 + 上报点击；不碰对话/LLM/采集。

export const VW = 384;
export const VH = 224;
const WALL_H = 32;

export type ImageMap = Record<string, HTMLImageElement>;

export const SPRITE_FILES: Record<string, string> = {
  boss_0: "/assets/sprites2/char2_boss_0.png", boss_1: "/assets/sprites2/char2_boss_1.png",
  manager_0: "/assets/sprites2/char2_manager_0.png", manager_1: "/assets/sprites2/char2_manager_1.png",
  sales_0: "/assets/sprites2/char2_sales_0.png", sales_1: "/assets/sprites2/char2_sales_1.png",
  clerk_0: "/assets/sprites2/char2_clerk_0.png", clerk_1: "/assets/sprites2/char2_clerk_1.png",
  floor: "/assets/sprites2/floor_wood.png", wall: "/assets/sprites2/wall.png",
  wall_baseboard: "/assets/sprites2/wall_baseboard.png", window: "/assets/sprites2/window.png",
  desk: "/assets/sprites2/desk.png", monitor: "/assets/sprites2/monitor_on.png",
  plant_large: "/assets/sprites2/plant_large.png", plant: "/assets/sprites2/plant.png",
  coffee: "/assets/sprites2/coffee.png", bookshelf: "/assets/sprites2/bookshelf.png",
  cabinet: "/assets/sprites2/cabinet.png", sofa: "/assets/sprites2/sofa.png",
  side_table: "/assets/sprites2/side_table.png", clock: "/assets/sprites2/clock.png",
  painting: "/assets/sprites2/painting.png", whiteboard: "/assets/sprites2/whiteboard.png",
};

export interface NpcSlot { id: PersonaId; name: string; emoji: string; x: number; y: number; }

// 4 工位一排
export const SLOTS: Omit<NpcSlot, "name" | "emoji">[] = [
  { id: "boss", x: 120, y: 156 },
  { id: "manager", x: 198, y: 156 },
  { id: "sales", x: 276, y: 156 },
  { id: "clerk", x: 352, y: 156 },
];

function nat(im?: HTMLImageElement) { return im ? { w: im.naturalWidth / 4, h: im.naturalHeight / 4 } : { w: 0, h: 0 }; }
function blit(ctx: CanvasRenderingContext2D, im: HTMLImageElement | undefined, dx: number, dy: number) {
  if (!im || !im.complete || im.naturalWidth === 0) return;
  const { w, h } = nat(im);
  ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, Math.round(dx), Math.round(dy), w, h);
}
function blitCB(ctx: CanvasRenderingContext2D, im: HTMLImageElement | undefined, cx: number, by: number, sw = 1, sh = 1) {
  if (!im || !im.complete || im.naturalWidth === 0) return;
  const { w, h } = nat(im);
  ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, Math.round(cx - (w * sw) / 2), Math.round(by - h * sh), w * sw, h * sh);
}

function drawFloorWalls(ctx: CanvasRenderingContext2D, im: ImageMap) {
  if (im.floor) {
    const t = nat(im.floor).w || 16;
    for (let y = WALL_H; y < VH; y += t) for (let x = 0; x < VW; x += t) {
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      if (h % 2) { ctx.save(); ctx.translate(Math.round(x + t), Math.round(y)); ctx.scale(-1, 1); blit(ctx, im.floor, 0, 0); ctx.restore(); }
      else blit(ctx, im.floor, x, y);
    }
  }
  for (let x = 0; x < VW; x += 16) { blit(ctx, im.wall, x, 0); blit(ctx, im.wall_baseboard, x, 16); }
  blit(ctx, im.window, 150, 0); blit(ctx, im.window, 250, 0);
  ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(0, 0, VW, 1);
  ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(0, WALL_H, VW, 1);
  for (const [sx, dir] of [[0, 1], [VW, -1]] as const) {
    const g = ctx.createLinearGradient(sx, 0, sx + dir * 8, 0);
    g.addColorStop(0, "rgba(0,0,0,0.12)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(dir > 0 ? 0 : VW - 8, WALL_H, 8, VH);
  }
  blitCB(ctx, im.clock, 40, 30);
  blitCB(ctx, im.whiteboard, 318, 31);
}

// 今日订单看板
function drawOrderBoard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const w = 92, h = 64;
  ctx.fillStyle = "#22304a"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#0d1626"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = "#3a4f73"; ctx.fillRect(x + 2, y + 2, w - 4, 12);
  ctx.font = "9px 'Fusion Pixel',monospace"; ctx.textBaseline = "middle";
  ctx.textAlign = "center"; ctx.fillStyle = "#ffe6a8"; ctx.fillText("今日订单", x + w / 2, y + 8);
  const rows = [["进口", "8", "#8fd0ff"], ["出口", "12", "#9be58a"], ["处理中", "5", "#ffd27a"], ["已完成", "18", "#cfd8e6"]];
  ctx.font = "8px 'Fusion Pixel',monospace";
  rows.forEach((r, i) => {
    const ry = y + 22 + i * 11;
    ctx.textAlign = "left"; ctx.fillStyle = "#aeb9cc"; ctx.fillText(r[0], x + 7, ry);
    ctx.textAlign = "right"; ctx.fillStyle = r[2]; ctx.fillText(r[1], x + w - 7, ry);
  });
}

// 运输追踪大屏（世界地图 + 移动的飞机/船/卡车）
function drawTracking(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const w = 116, h = 64;
  ctx.fillStyle = "#10324a"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#06202f"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = "#2f5d77"; ctx.fillRect(x + 2, y + 2, w - 4, 11);
  ctx.font = "9px 'Fusion Pixel',monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  ctx.fillStyle = "#cdeaff"; ctx.fillText("运输追踪大屏", x + w / 2, y + 7);
  // 简易大陆
  ctx.fillStyle = "#3f7d57";
  const land = [[10, 22, 26, 14], [42, 18, 22, 10], [40, 34, 30, 16], [74, 24, 28, 18], [16, 40, 18, 10]];
  for (const [lx, ly, lw, lh] of land) ctx.fillRect(x + lx, y + ly, lw, lh);
  // 航线点
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  for (let i = 0; i < w - 8; i += 6) ctx.fillRect(x + 4 + i, y + 30, 2, 1);
  const p = (t / 2600) % 1;
  ctx.fillStyle = "#ffe27a"; ctx.fillRect(Math.round(x + 6 + p * (w - 14)), y + 28, 3, 2); // 飞机
  const p2 = (t / 4200) % 1;
  ctx.fillStyle = "#ff9b6a"; ctx.fillRect(Math.round(x + w - 8 - p2 * (w - 16)), y + 46, 3, 2); // 船
  ctx.fillStyle = "#9be58a"; ctx.fillRect(Math.round(x + 8 + ((t / 3400) % 1) * (w - 16)), y + 54, 3, 2); // 卡车
}

// 前台标语 + WELCOME
function drawReception(ctx: CanvasRenderingContext2D, im: ImageMap) {
  blitCB(ctx, im.cabinet, 30, 96);
  ctx.font = "10px 'Fusion Pixel',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#c0392b"; ctx.fillText("客户至上", 38, 116); ctx.fillText("服务全球", 38, 130);
  // WELCOME 牌
  ctx.fillStyle = "#2f6b3a"; ctx.fillRect(12, 184, 56, 16);
  ctx.strokeStyle = "#13351c"; ctx.lineWidth = 1; ctx.strokeRect(12.5, 184.5, 55, 15);
  ctx.fillStyle = "#eafbe8"; ctx.font = "8px 'Fusion Pixel',monospace"; ctx.fillText("WELCOME", 40, 192);
}

let vignette: CanvasGradient | null = null;
function postGrade(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgba(255,228,184,0.15)"; ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = "rgba(70,50,100,0.10)"; ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = "source-over";
  if (!vignette) { vignette = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.34, VW / 2, VH / 2, VH * 0.9); vignette.addColorStop(0, "rgba(20,12,28,0)"); vignette.addColorStop(1, "rgba(20,12,28,0.46)"); }
  ctx.globalAlpha = 0.92 + 0.08 * Math.sin(t / 1800); ctx.fillStyle = vignette; ctx.fillRect(0, 0, VW, VH);
  ctx.restore();
}

function nameTag(ctx: CanvasRenderingContext2D, cx: number, by: number, name: string, hi: boolean) {
  ctx.font = "9px 'Fusion Pixel',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = Math.max(ctx.measureText(name).width + 10, 26), x = Math.round(cx - w / 2), y = Math.round(by + 4);
  ctx.fillStyle = hi ? "rgba(201,93,46,0.96)" : "rgba(30,22,38,0.86)"; ctx.fillRect(x, y, Math.round(w), 13);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x, y, Math.round(w), 1);
  ctx.fillStyle = "#f6efe2"; ctx.fillText(name, cx, y + 7);
}
function bubble(ctx: CanvasRenderingContext2D, cx: number, topY: number, emoji: string, hi: boolean) {
  const y = topY - 14;
  ctx.fillStyle = "#fffaf0"; ctx.fillRect(cx - 9, y, 18, 13); ctx.fillRect(cx - 2, y + 13, 3, 3);
  ctx.strokeStyle = hi ? "rgba(201,93,46,0.9)" : "rgba(40,30,50,0.4)"; ctx.lineWidth = 1; ctx.strokeRect(cx - 8.5, y + 0.5, 17, 12);
  ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(emoji, cx, y + 6);
}

export interface DrawState { images: ImageMap; slots: NpcSlot[]; hoveredId: PersonaId | null; timeMs: number; }

export function drawScene(ctx: CanvasRenderingContext2D, s: DrawState) {
  const im = s.images, t = s.timeMs;
  ctx.clearRect(0, 0, VW, VH);
  drawFloorWalls(ctx, im);
  // 上方两块屏
  drawOrderBoard(ctx, 96, 40);
  drawTracking(ctx, 198, 40, t);
  // 前台
  drawReception(ctx, im);
  // 陈设
  blitCB(ctx, im.bookshelf, 312, 120);
  blitCB(ctx, im.sofa, 70, 206); blitCB(ctx, im.side_table, 104, 206);
  blitCB(ctx, im.plant_large, 372, VH); blitCB(ctx, im.coffee, 300, 196);
  // 工位
  const pods = [...s.slots].sort((a, b) => a.y - b.y);
  const frame = t % 760 < 380 ? "0" : "1";
  for (const slot of pods) {
    const cx = slot.x, by = slot.y, hi = s.hoveredId === slot.id;
    if (hi) { ctx.fillStyle = "rgba(255,220,140,0.25)"; ctx.beginPath(); ctx.ellipse(cx, by + 6, 22, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    blitCB(ctx, im.desk, cx, by);
    blitCB(ctx, im.monitor, cx, by - 5);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(120,210,150,${0.06 + 0.05 * Math.sin(t / 220 + cx)})`; ctx.fillRect(cx - 6, by - 33, 12, 8); ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(cx, by + 15, hi ? 11 : 9, hi ? 3 : 2.5, 0, 0, Math.PI * 2); ctx.fill();
    blitCB(ctx, im[`${slot.id}_${frame}`], cx, by + 15, hi ? 1.06 : 1, hi ? 0.98 : 1);
  }
  postGrade(ctx, t);
  // UI 层
  for (const slot of pods) {
    const cx = slot.x, by = slot.y, hi = s.hoveredId === slot.id;
    if (hi) { ctx.strokeStyle = "rgba(255,214,140,0.9)"; ctx.lineWidth = 1; ctx.strokeRect(cx - 13, by - 6, 26, 24); }
    bubble(ctx, cx, by - 3 + (frame === "1" ? -1 : 0), slot.emoji, hi);
    nameTag(ctx, cx, by + 16, slot.name, hi);
  }
}

export function hitTest(slots: NpcSlot[], vx: number, vy: number): PersonaId | null {
  for (const slot of slots) if (vx >= slot.x - 16 && vx <= slot.x + 16 && vy >= slot.y - 34 && vy <= slot.y + 20) return slot.id;
  return null;
}
