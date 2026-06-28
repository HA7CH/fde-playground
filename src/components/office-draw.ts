import type { PersonaId } from "@/lib/types";

// 哑渲染层（Kairosoft 级）：cozy 像素办公室。
// 素材：Pixel Agents(MIT, 家具) + 派生瓦片(CC0) + Ninja Adventure(CC0, 角色)，见 CREDITS。
// 全部素材是 16px 原画 ×4 放大 → 一律按 naturalW/4 × naturalH/4 绘制（干净整数降采样）。
// 只画 + 上报点击；不碰对话/LLM/采集。

export const VW = 320;
export const VH = 200;
const WALL_H = 32;

export type ImageMap = Record<string, HTMLImageElement>;

export const SPRITE_FILES: Record<string, string> = {
  // 角色（各 2 帧 idle）
  boss_0: "/assets/sprites2/char2_boss_0.png",
  boss_1: "/assets/sprites2/char2_boss_1.png",
  manager_0: "/assets/sprites2/char2_manager_0.png",
  manager_1: "/assets/sprites2/char2_manager_1.png",
  sales_0: "/assets/sprites2/char2_sales_0.png",
  sales_1: "/assets/sprites2/char2_sales_1.png",
  clerk_0: "/assets/sprites2/char2_clerk_0.png",
  clerk_1: "/assets/sprites2/char2_clerk_1.png",
  // 瓦片 / 家具
  floor: "/assets/sprites2/floor_wood.png",
  wall: "/assets/sprites2/wall.png",
  wall_baseboard: "/assets/sprites2/wall_baseboard.png",
  window: "/assets/sprites2/window.png",
  rug: "/assets/sprites2/rug.png",
  desk: "/assets/sprites2/desk.png",
  monitor: "/assets/sprites2/monitor_on.png",
  meeting: "/assets/sprites2/meeting_table.png",
  plant_large: "/assets/sprites2/plant_large.png",
  coffee: "/assets/sprites2/coffee.png",
  bookshelf: "/assets/sprites2/bookshelf.png",
  clock: "/assets/sprites2/clock.png",
  painting: "/assets/sprites2/painting.png",
  whiteboard: "/assets/sprites2/whiteboard.png",
};

export interface NpcSlot {
  id: PersonaId;
  name: string;
  emoji: string;
  x: number; // pod 中心
  y: number; // 桌底 / 角色站位基线
}

// 4 工位（左右两 pod 夹中央会议区）
export const SLOTS: Omit<NpcSlot, "name" | "emoji">[] = [
  { id: "boss", x: 72, y: 96 },
  { id: "manager", x: 248, y: 96 },
  { id: "sales", x: 72, y: 178 },
  { id: "clerk", x: 248, y: 178 },
];

function nat(im?: HTMLImageElement) {
  return im ? { w: im.naturalWidth / 4, h: im.naturalHeight / 4 } : { w: 0, h: 0 };
}
// 左上角对齐画
function blit(ctx: CanvasRenderingContext2D, im: HTMLImageElement | undefined, dx: number, dy: number) {
  if (!im || !im.complete || im.naturalWidth === 0) return;
  const { w, h } = nat(im);
  ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, Math.round(dx), Math.round(dy), w, h);
}
// 中心 x / 底 y 对齐画（家具、角色站地上）
function blitCB(ctx: CanvasRenderingContext2D, im: HTMLImageElement | undefined, cx: number, by: number, scaleW = 1, scaleH = 1) {
  if (!im || !im.complete || im.naturalWidth === 0) return;
  const { w, h } = nat(im);
  const dw = w * scaleW;
  const dh = h * scaleH;
  ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, Math.round(cx - dw / 2), Math.round(by - dh), dw, dh);
}

function drawFloorAndWalls(ctx: CanvasRenderingContext2D, im: ImageMap) {
  const floor = im.floor;
  // 暖木地板 + 确定性翻转破重复
  if (floor) {
    const { w } = nat(floor);
    const t = w || 16;
    for (let y = WALL_H; y < VH; y += t) {
      for (let x = 0; x < VW; x += t) {
        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        if (h % 2) {
          ctx.save();
          ctx.translate(Math.round(x + t), Math.round(y));
          ctx.scale(-1, 1);
          blit(ctx, floor, 0, 0);
          ctx.restore();
        } else {
          blit(ctx, floor, x, y);
        }
      }
    }
  }
  // 墙带：上 wall，下 wall_baseboard
  for (let x = 0; x < VW; x += 16) {
    blit(ctx, im.wall, x, 0);
    blit(ctx, im.wall_baseboard, x, 16);
  }
  // 窗
  blit(ctx, im.window, 118, 0);
  blit(ctx, im.window, 188, 0);
  // 顶线高光 + 墙脚阴影 + 角落 AO
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(0, 0, VW, 1);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(0, WALL_H, VW, 1);
  const ao = ctx.createLinearGradient(0, 0, 8, 0);
  ao.addColorStop(0, "rgba(0,0,0,0.12)");
  ao.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ao;
  ctx.fillRect(0, WALL_H, 8, VH);
  const ao2 = ctx.createLinearGradient(VW, 0, VW - 8, 0);
  ao2.addColorStop(0, "rgba(0,0,0,0.12)");
  ao2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ao2;
  ctx.fillRect(VW - 8, WALL_H, 8, VH);
  // 墙饰
  blitCB(ctx, im.clock, 44, 30);
  blitCB(ctx, im.painting, 90, 31);
  blitCB(ctx, im.whiteboard, 224, 31);
}

// 窗光轴
function drawWindowLight(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const wx of [126, 196]) {
    ctx.beginPath();
    ctx.moveTo(wx - 8, WALL_H);
    ctx.lineTo(wx + 8, WALL_H);
    ctx.lineTo(wx + 26, VH);
    ctx.lineTo(wx - 26, VH);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, WALL_H, 0, VH);
    g.addColorStop(0, "rgba(255,238,180,0.13)");
    g.addColorStop(1, "rgba(255,238,180,0)");
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
}

let vignette: CanvasGradient | null = null;
function postGrade(ctx: CanvasRenderingContext2D, timeMs: number) {
  // 暖钨丝光罩
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(255,228,184,0.16)";
  ctx.fillRect(0, 0, VW, VH);
  // 冷阴影微调
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(70,50,100,0.10)";
  ctx.fillRect(0, 0, VW, VH);
  // vignette（缓存），随呼吸微动
  ctx.globalCompositeOperation = "source-over";
  if (!vignette) {
    vignette = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.85);
    vignette.addColorStop(0, "rgba(20,12,28,0)");
    vignette.addColorStop(1, "rgba(20,12,28,0.5)");
  }
  ctx.globalAlpha = 0.92 + 0.08 * Math.sin(timeMs / 1800);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VW, VH);
  ctx.restore();
}

function drawSteam(ctx: CanvasRenderingContext2D, cx: number, topY: number, timeMs: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const p = ((timeMs / 900 + i / 3) % 1);
    const y = topY - p * 12;
    const a = (1 - p) * 0.5;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(Math.round(cx + Math.sin(p * 6 + i) * 1.5), Math.round(y), 1, 1);
  }
  ctx.restore();
}

function drawNameTag(ctx: CanvasRenderingContext2D, cx: number, baseY: number, name: string, hi: boolean) {
  ctx.font = "9px 'Fusion Pixel','Zpix',monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = Math.max(ctx.measureText(name).width + 10, 26);
  const x = Math.round(cx - w / 2);
  const y = Math.round(baseY + 4);
  ctx.fillStyle = hi ? "rgba(201,93,46,0.96)" : "rgba(30,22,38,0.86)";
  ctx.fillRect(x, y, Math.round(w), 13);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x, y, Math.round(w), 1);
  ctx.fillStyle = "#f6efe2";
  ctx.fillText(name, cx, y + 7);
}

function drawBubble(ctx: CanvasRenderingContext2D, cx: number, topY: number, emoji: string, hi: boolean) {
  const y = topY - 14;
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(cx - 9, y, 18, 13);
  ctx.fillRect(cx - 2, y + 13, 3, 3);
  ctx.strokeStyle = hi ? "rgba(201,93,46,0.9)" : "rgba(40,30,50,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 8.5, y + 0.5, 17, 12);
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, cx, y + 6);
}

export interface DrawState {
  images: ImageMap;
  slots: NpcSlot[];
  hoveredId: PersonaId | null;
  timeMs: number;
}

export function drawScene(ctx: CanvasRenderingContext2D, s: DrawState) {
  const im = s.images;
  ctx.clearRect(0, 0, VW, VH);

  // 背景：地板 + 墙 + 墙饰
  drawFloorAndWalls(ctx, im);
  drawWindowLight(ctx);

  // 中央会议区
  blitCB(ctx, im.rug, 160, 172);
  blitCB(ctx, im.meeting, 160, 176);

  // 角落绿植（后）+ 书架 + 饮水机
  blitCB(ctx, im.bookshelf, 300, 48);
  blitCB(ctx, im.plant_large, 16, VH);
  blitCB(ctx, im.plant_large, 304, VH);
  blitCB(ctx, im.coffee, 300, 152);
  drawSteam(ctx, 300, 138, s.timeMs);

  // 工位（按 y 排序，深度）
  const pods = [...s.slots].sort((a, b) => a.y - b.y);
  const frame = s.timeMs % 760 < 380 ? "0" : "1";
  for (const slot of pods) {
    const cx = slot.x;
    const by = slot.y;
    const hi = s.hoveredId === slot.id;
    // 桌 + 显示器（在角色后/上）
    blitCB(ctx, im.desk, cx, by);
    blitCB(ctx, im.monitor, cx, by - 5);
    // 显示器辉光闪烁
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(120,210,150,${0.06 + 0.05 * Math.sin(s.timeMs / 220 + cx)})`;
    ctx.fillRect(cx - 6, by - 33, 12, 8);
    ctx.restore();
    // 角色（站桌前），2 帧 idle，hover 轻微 squash
    const char = im[`${slot.id}_${frame}`];
    if (hi) {
      // 接地软影
      ctx.fillStyle = "rgba(0,0,0,0.20)";
      ctx.beginPath();
      ctx.ellipse(cx, by + 15, 11, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      blitCB(ctx, char, cx, by + 15, 1.06, 0.98);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.beginPath();
      ctx.ellipse(cx, by + 15, 9, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      blitCB(ctx, char, cx, by + 15);
    }
  }

  // 全局色调 + vignette
  postGrade(ctx, s.timeMs);

  // UI 层（post 之后，保持清晰）：名牌 + 气泡 + hover 提示
  for (const slot of pods) {
    const cx = slot.x;
    const by = slot.y;
    const hi = s.hoveredId === slot.id;
    if (hi) {
      ctx.strokeStyle = "rgba(255,214,140,0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 13, by - 6, 26, 24);
    }
    drawBubble(ctx, cx, by - 3 + (frame === "1" ? -1 : 0), slot.emoji, hi);
    drawNameTag(ctx, cx, by + 16, slot.name, hi);
  }

  // 标题卡
  ctx.font = "9px 'Fusion Pixel','Zpix',monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const label = "WAYBOUND 货代 · 需求群";
  const tw = ctx.measureText(label).width + 12;
  ctx.fillStyle = "rgba(30,22,38,0.8)";
  ctx.fillRect(6, VH - 18, tw, 13);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(6, VH - 18, tw, 1);
  ctx.fillStyle = "#f6efe2";
  ctx.fillText(label, 12, VH - 11);
}

/** 命中：整个 pod（桌+显示器+角色）可点 */
export function hitTest(slots: NpcSlot[], vx: number, vy: number): PersonaId | null {
  for (const slot of slots) {
    if (vx >= slot.x - 16 && vx <= slot.x + 16 && vy >= slot.y - 34 && vy <= slot.y + 20) {
      return slot.id;
    }
  }
  return null;
}
