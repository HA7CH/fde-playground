import type { PersonaId } from "@/lib/types";

// 哑渲染层：货代办公室。老板专属玻璃办公室(右) + 开放区 11 人(主管+10 跟单/业务)。
// 素材 16px×4，按 naturalW/4 绘制。只画 + 上报点击。
export const VW = 480;
export const VH = 288;
const WALL_H = 32;
const ROOM_X = 366; // 老板办公室隔断

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
  sofa: "/assets/sprites2/sofa.png", clock: "/assets/sprites2/clock.png", whiteboard: "/assets/sprites2/whiteboard.png",
};

export interface NpcSlot { id: PersonaId; name: string; emoji: string; sprite: string; x: number; y: number; room?: boolean; }

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
  blit(ctx, im.window, 132, 0); blit(ctx, im.window, 220, 0);
  ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(0, 0, VW, 1);
  ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(0, WALL_H, VW, 1);
  blitCB(ctx, im.clock, 46, 30);
  blitCB(ctx, im.whiteboard, 300, 31);
}

function drawOrderBoard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const w = 96, h = 64;
  ctx.fillStyle = "#22304a"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#0d1626"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = "#3a4f73"; ctx.fillRect(x + 2, y + 2, w - 4, 12);
  ctx.font = "9px 'Fusion Pixel',monospace"; ctx.textBaseline = "middle";
  ctx.textAlign = "center"; ctx.fillStyle = "#ffe6a8"; ctx.fillText("今日订单", x + w / 2, y + 8);
  const rows = [["进口", "8", "#8fd0ff"], ["出口", "12", "#9be58a"], ["处理中", "5", "#ffd27a"], ["已完成", "18", "#cfd8e6"]];
  ctx.font = "8px 'Fusion Pixel',monospace";
  rows.forEach((r, i) => {
    const ry = y + 22 + i * 11;
    ctx.textAlign = "left"; ctx.fillStyle = "#aeb9cc"; ctx.fillText(r[0], x + 8, ry);
    ctx.textAlign = "right"; ctx.fillStyle = r[2]; ctx.fillText(r[1], x + w - 8, ry);
  });
}

function drawPlaque(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x + 1, y + 2, w, h);
  ctx.fillStyle = "#caa46a"; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = "#f3e2bf"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#6b4e34"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = "#8a6a3f"; ctx.fillRect(x + 3, y - 3, 2, 3); ctx.fillRect(x + w - 5, y - 3, 2, 3);
}
function drawReception(ctx: CanvasRenderingContext2D) {
  drawPlaque(ctx, 12, 44, 74, 42);
  ctx.font = "11px 'Fusion Pixel',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#c0392b"; ctx.fillText("客户至上", 49, 57); ctx.fillText("服务全球", 49, 73);
  const wx = 296, wy = 98; // 挪到主管阿强右上角的空墙
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(wx + 1, wy + 2, 60, 16);
  ctx.fillStyle = "#2f6b3a"; ctx.fillRect(wx, wy, 60, 16);
  ctx.strokeStyle = "#13351c"; ctx.lineWidth = 1; ctx.strokeRect(wx + 0.5, wy + 0.5, 59, 15);
  ctx.fillStyle = "#eafbe8"; ctx.font = "9px 'Fusion Pixel',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("WELCOME", wx + 30, wy + 8);
}

// 老板专属办公室隔断
function drawBossRoom(ctx: CanvasRenderingContext2D, im: ImageMap) {
  // 玻璃隔断（上半，带竖框）
  ctx.fillStyle = "rgba(150,205,235,0.20)"; ctx.fillRect(ROOM_X + 4, WALL_H, VW - ROOM_X - 4, 78);
  // 墙柱（留门洞 y 150..196）
  ctx.fillStyle = "#6b5747";
  ctx.fillRect(ROOM_X, WALL_H, 5, 118 - WALL_H);
  ctx.fillRect(ROOM_X, 196, 5, VH - 196);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(ROOM_X, WALL_H, 5, 1);
  // 竖向窗框
  ctx.strokeStyle = "rgba(40,60,72,0.5)"; ctx.lineWidth = 1;
  for (let gx = ROOM_X + 26; gx < VW - 4; gx += 26) { ctx.beginPath(); ctx.moveTo(gx + 0.5, WALL_H); ctx.lineTo(gx + 0.5, WALL_H + 78); ctx.stroke(); }
  // 老板专属陈设：沙发 + 绿植
  blitCB(ctx, im.sofa, VW - 30, VH - 6);
  blitCB(ctx, im.plant_large, VW - 16, VH);
  // 门牌
  ctx.fillStyle = "#b4571c"; ctx.fillRect(ROOM_X + 8, WALL_H + 6, 54, 13);
  ctx.fillStyle = "#fff7e6"; ctx.font = "8px 'Fusion Pixel',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("老板办公室", ROOM_X + 35, WALL_H + 12);
}

let vignette: CanvasGradient | null = null;
function postGrade(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgba(255,228,184,0.15)"; ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = "rgba(70,50,100,0.10)"; ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = "source-over";
  if (!vignette) { vignette = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.36, VW / 2, VH / 2, VH * 0.95); vignette.addColorStop(0, "rgba(20,12,28,0)"); vignette.addColorStop(1, "rgba(20,12,28,0.42)"); }
  ctx.globalAlpha = 0.92 + 0.08 * Math.sin(t / 1800); ctx.fillStyle = vignette; ctx.fillRect(0, 0, VW, VH);
  ctx.restore();
}

function nameTag(ctx: CanvasRenderingContext2D, cx: number, by: number, name: string, hi: boolean) {
  ctx.font = "8px 'Fusion Pixel',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = Math.max(ctx.measureText(name).width + 8, 22), x = Math.round(cx - w / 2), y = Math.round(by + 3);
  ctx.fillStyle = hi ? "rgba(201,93,46,0.96)" : "rgba(30,22,38,0.82)"; ctx.fillRect(x, y, Math.round(w), 12);
  ctx.fillStyle = "#f6efe2"; ctx.fillText(name, cx, y + 6);
}
function bubble(ctx: CanvasRenderingContext2D, cx: number, topY: number, emoji: string, hi: boolean) {
  const y = topY - 13;
  ctx.fillStyle = "#fffaf0"; ctx.fillRect(cx - 8, y, 16, 12); ctx.fillRect(cx - 2, y + 12, 3, 3);
  ctx.strokeStyle = hi ? "rgba(201,93,46,0.9)" : "rgba(40,30,50,0.4)"; ctx.lineWidth = 1; ctx.strokeRect(cx - 7.5, y + 0.5, 15, 11);
  ctx.font = "9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(emoji, cx, y + 5);
}

export interface DrawState { images: ImageMap; slots: NpcSlot[]; hoveredId: PersonaId | null; timeMs: number; }

export function drawScene(ctx: CanvasRenderingContext2D, s: DrawState) {
  const im = s.images, t = s.timeMs;
  ctx.clearRect(0, 0, VW, VH);
  drawFloorWalls(ctx, im);
  drawOrderBoard(ctx, 96, 42);
  drawReception(ctx);
  drawBossRoom(ctx, im);
  // 开放区陈设
  blitCB(ctx, im.plant_large, 16, VH);
  blitCB(ctx, im.plant_large, 348, VH);

  const pods = [...s.slots].sort((a, b) => a.y - b.y);
  const frame = t % 760 < 380 ? "0" : "1";
  for (const slot of pods) {
    const cx = slot.x, by = slot.y, hi = s.hoveredId === slot.id;
    if (hi) { ctx.fillStyle = "rgba(255,220,140,0.25)"; ctx.beginPath(); ctx.ellipse(cx, by + 6, 20, 7, 0, 0, Math.PI * 2); ctx.fill(); }
    blitCB(ctx, im.desk, cx, by);
    blitCB(ctx, im.monitor, cx, by - 5);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(120,210,150,${0.06 + 0.05 * Math.sin(t / 220 + cx)})`; ctx.fillRect(cx - 6, by - 33, 12, 8); ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(cx, by + 15, hi ? 11 : 9, hi ? 3 : 2.5, 0, 0, Math.PI * 2); ctx.fill();
    blitCB(ctx, im[`${slot.sprite}_${frame}`], cx, by + 15, hi ? 1.06 : 1, hi ? 0.98 : 1);
  }
  postGrade(ctx, t);
  for (const slot of pods) {
    const cx = slot.x, by = slot.y, hi = s.hoveredId === slot.id;
    if (hi) { ctx.strokeStyle = "rgba(255,214,140,0.9)"; ctx.lineWidth = 1; ctx.strokeRect(cx - 13, by - 6, 26, 24); }
    bubble(ctx, cx, by - 3 + (frame === "1" ? -1 : 0), slot.emoji, hi);
    nameTag(ctx, cx, by + 16, slot.name, hi);
  }
}

export function hitTest(slots: NpcSlot[], vx: number, vy: number): PersonaId | null {
  for (const slot of slots) if (vx >= slot.x - 15 && vx <= slot.x + 15 && vy >= slot.y - 32 && vy <= slot.y + 18) return slot.id;
  return null;
}
