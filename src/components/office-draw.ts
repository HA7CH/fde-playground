import type { PersonaId } from "@/lib/types";

// 哑渲染层：用 CC0 像素精灵（Kenney，64×64，源自 16px 4x 放大）画一个 top-down 办公室。
// 整数倍降采样（64→32 / 64→16）+ imageSmoothingEnabled=false 保持像素锐利。
// 只画 + 提供命中盒；不碰对话/LLM/采集。

export const VW = 320;
export const VH = 200;

export type ImageMap = Record<string, HTMLImageElement>;

// 渲染需要的精灵 key → 文件
export const SPRITE_FILES: Record<string, string> = {
  boss: "/assets/sprites/char_boss.png",
  manager: "/assets/sprites/char_manager.png",
  sales: "/assets/sprites/char_sales.png",
  clerk: "/assets/sprites/char_clerk.png",
  desk: "/assets/sprites/desk.png",
  plant: "/assets/sprites/plant.png",
  floor: "/assets/sprites/floor.png",
  wall: "/assets/sprites/wall.png",
};

export interface NpcSlot {
  id: PersonaId;
  name: string;
  emoji: string;
  x: number; // 工位中心（虚拟坐标，character 站位）
  y: number;
}

// 4 工位布局（2×2）
export const SLOTS: Omit<NpcSlot, "name" | "emoji">[] = [
  { id: "boss", x: 78, y: 92 },
  { id: "manager", x: 242, y: 92 },
  { id: "sales", x: 78, y: 166 },
  { id: "clerk", x: 242, y: 166 },
];

const TILE = 16; // 地板/墙 绘制尺寸（64→16，÷4 干净）
const CHAR = 34; // 角色绘制尺寸
const DESK = 34; // 桌子绘制尺寸
const WALL_H = 32; // 墙带高度

function img(ctx: CanvasRenderingContext2D, im: HTMLImageElement | undefined, dx: number, dy: number, dw: number, dh: number) {
  if (!im || !im.complete || im.naturalWidth === 0) return;
  ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, Math.round(dx), Math.round(dy), dw, dh);
}

function drawFloor(ctx: CanvasRenderingContext2D, images: ImageMap) {
  const floor = images.floor;
  const wall = images.wall;
  // 地板平铺
  for (let y = WALL_H; y < VH; y += TILE) {
    for (let x = 0; x < VW; x += TILE) img(ctx, floor, x, y, TILE, TILE);
  }
  // 墙带（顶部两行）
  for (let x = 0; x < VW; x += TILE) {
    img(ctx, wall, x, 0, TILE, TILE);
    img(ctx, wall, x, TILE, TILE, TILE);
  }
  // 墙脚阴影
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, WALL_H, VW, 3);
  // 角落绿植
  img(ctx, images.plant, 6, VH - 30, 24, 24);
  img(ctx, images.plant, VW - 30, WALL_H + 6, 24, 24);
}

function drawNameTag(ctx: CanvasRenderingContext2D, cx: number, cy: number, name: string, highlight: boolean) {
  ctx.font = "9px 'Fusion Pixel','Zpix',monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = Math.max(ctx.measureText(name).width + 10, 24);
  const x = cx - w / 2;
  const y = cy + 16;
  ctx.fillStyle = highlight ? "rgba(201,93,46,0.95)" : "rgba(28,22,34,0.85)";
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 13);
  ctx.fillStyle = "#f4ecdf";
  ctx.fillText(name, cx, y + 7);
}

function drawBubble(ctx: CanvasRenderingContext2D, cx: number, topY: number, emoji: string) {
  const y = topY - 13;
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(cx - 9, y, 18, 13);
  ctx.fillRect(cx - 2, y + 13, 3, 3);
  ctx.strokeStyle = "rgba(40,30,50,0.45)";
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
  ctx.clearRect(0, 0, VW, VH);
  drawFloor(ctx, s.images);

  // 按 y 排序（下面的后画 = 深度）
  const ordered = [...s.slots].sort((a, b) => a.y - b.y);
  for (const slot of ordered) {
    const bob = Math.round(Math.sin(s.timeMs / 360 + slot.x + slot.y) * 1.4);
    const hi = s.hoveredId === slot.id;
    // 悬停柔光
    if (hi) {
      ctx.fillStyle = "rgba(255,220,140,0.28)";
      ctx.beginPath();
      ctx.ellipse(slot.x, slot.y + 6, 22, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 影子
    ctx.fillStyle = "rgba(0,0,0,0.20)";
    ctx.beginPath();
    ctx.ellipse(slot.x, slot.y + 10, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 角色（在桌后），带 idle bob
    img(ctx, s.images[slot.id], slot.x - CHAR / 2, slot.y - CHAR + 6 + bob, CHAR, CHAR);
    // 桌子（在角色下半身前面）
    img(ctx, s.images.desk, slot.x - DESK / 2, slot.y - 2, DESK, DESK);
    // 头顶气泡 + 名牌
    drawBubble(ctx, slot.x, slot.y - CHAR + 8 + bob, slot.emoji);
    drawNameTag(ctx, slot.x, slot.y, slot.name, hi);
  }
}

/** 命中：人 + 桌 + 名牌区域 */
export function hitTest(slots: NpcSlot[], vx: number, vy: number): PersonaId | null {
  for (const slot of slots) {
    if (vx >= slot.x - 18 && vx <= slot.x + 18 && vy >= slot.y - 30 && vy <= slot.y + 30) {
      return slot.id;
    }
  }
  return null;
}
