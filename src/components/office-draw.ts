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
  v1_0: "/assets/sprites2/char2_v1_0.png", v1_1: "/assets/sprites2/char2_v1_1.png",
  v2_0: "/assets/sprites2/char2_v2_0.png", v2_1: "/assets/sprites2/char2_v2_1.png",
  v3_0: "/assets/sprites2/char2_v3_0.png", v3_1: "/assets/sprites2/char2_v3_1.png",
  v4_0: "/assets/sprites2/char2_v4_0.png", v4_1: "/assets/sprites2/char2_v4_1.png",
  v5_0: "/assets/sprites2/char2_v5_0.png", v5_1: "/assets/sprites2/char2_v5_1.png",
  v6_0: "/assets/sprites2/char2_v6_0.png", v6_1: "/assets/sprites2/char2_v6_1.png",
  floor: "/assets/sprites2/floor_wood.png", wall: "/assets/sprites2/wall.png",
  wall_baseboard: "/assets/sprites2/wall_baseboard.png", window: "/assets/sprites2/window.png",
  desk: "/assets/sprites2/desk.png", monitor: "/assets/sprites2/monitor_on.png",
  plant_large: "/assets/sprites2/plant_large.png", plant: "/assets/sprites2/plant.png",
  coffee: "/assets/sprites2/coffee.png", bookshelf: "/assets/sprites2/bookshelf.png",
  sofa: "/assets/sprites2/sofa.png", clock: "/assets/sprites2/clock.png", whiteboard: "/assets/sprites2/whiteboard.png",
};

export interface NpcSlot { id: PersonaId; name: string; emoji: string; sprite: string; x: number; y: number; room?: boolean; offH?: number; }

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

function drawFloorWalls(ctx: CanvasRenderingContext2D, im: ImageMap, gh: number) {
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
  drawWallClock(ctx, 46, 22, gh);
  blitCB(ctx, im.whiteboard, 300, 31);
}

// 自绘挂钟：表盘圆心精确，指针跟游戏时间走
function drawWallClock(ctx: CanvasRenderingContext2D, cx: number, cy: number, gh: number) {
  ctx.fillStyle = "rgba(0,0,0,0.20)"; ctx.beginPath(); ctx.arc(cx + 1, cy + 1, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#8a2f26"; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f6efe2"; ctx.beginPath(); ctx.arc(cx, cy, 5.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#6b5747";
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; ctx.fillRect(cx + Math.cos(a) * 4.2 - 0.5, cy + Math.sin(a) * 4.2 - 0.5, 1, 1); }
  const ha = ((gh % 12) / 12) * Math.PI * 2 - Math.PI / 2;
  const ma = (((gh * 60) % 60) / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ha) * 2.6, cy + Math.sin(ha) * 2.6); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ma) * 4.2, cy + Math.sin(ma) * 4.2); ctx.stroke();
}

// 自绘饮水机：白机身 + 蓝水桶 + 水杯位（喝水动线的目的地）
function drawCooler(ctx: CanvasRenderingContext2D, cx: number, by: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(cx, by + 1, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8eef2"; ctx.fillRect(cx - 5, by - 15, 10, 15);
  ctx.strokeStyle = "#5a6b78"; ctx.lineWidth = 1; ctx.strokeRect(cx - 4.5, by - 14.5, 9, 14);
  ctx.fillStyle = "#7ec3e8"; ctx.fillRect(cx - 4, by - 21, 8, 6);
  ctx.fillStyle = "#c4e6f5"; ctx.fillRect(cx - 3, by - 20, 3, 3);
  ctx.strokeStyle = "#4a7c9c"; ctx.strokeRect(cx - 4.5, by - 21.5, 9, 7);
  ctx.fillStyle = "#3b4a55"; ctx.fillRect(cx - 3, by - 9, 2, 3); ctx.fillRect(cx + 1, by - 9, 2, 3);
  ctx.fillStyle = "#8fd0ff"; ctx.fillRect(cx - 3, by - 12, 6, 2);
}

function drawOrderBoard(ctx: CanvasRenderingContext2D, x: number, y: number, processing: number, completed: number) {
  const w = 96, h = 64;
  ctx.fillStyle = "#22304a"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#0d1626"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = "#3a4f73"; ctx.fillRect(x + 2, y + 2, w - 4, 12);
  ctx.font = "9px 'Fusion Pixel',monospace"; ctx.textBaseline = "middle";
  ctx.textAlign = "center"; ctx.fillStyle = "#ffe6a8"; ctx.fillText("今日订单", x + w / 2, y + 8);
  const hot = processing >= 20; // 处理中堆多了 → 标红提醒
  const rows: [string, string, string][] = [
    ["进口", "8", "#8fd0ff"], ["出口", "12", "#9be58a"],
    ["处理中", String(Math.min(999, processing)), hot ? "#ff6b6b" : "#ffd27a"],
    ["已完成", String(completed), "#cfd8e6"],
  ];
  ctx.font = "8px 'Fusion Pixel',monospace";
  rows.forEach((r, i) => {
    const ry = y + 22 + i * 11;
    ctx.textAlign = "left"; ctx.fillStyle = "#aeb9cc"; ctx.fillText(r[0], x + 8, ry);
    ctx.textAlign = "right"; ctx.fillStyle = r[2]; ctx.fillText(r[1], x + w - 8, ry);
  });
}

// 新订单进来：随机一个开放区同事头顶冒「+1」上浮淡出（纯时间驱动，无状态）
// 跟作息走：午休不进单；早高峰(9-10)/午后高峰(13-14)最密，晚上加班时段稀疏
function orderPop(ctx: CanvasRenderingContext2D, slots: NpcSlot[], t: number, gh: number) {
  if (gh >= 12 && gh < 13) return; // 午休
  const front = slots.filter((s) => !s.room);
  if (!front.length) return;
  const CYCLE = gh < 10 || (gh >= 13 && gh < 14) ? 2200 : gh >= 18 ? 7600 : 4200;
  const SHOW = 1500;
  const idx = Math.floor(t / CYCLE);
  const phase = t % CYCLE;
  if (phase > SHOW) return;
  const slot = front[(idx * 5 + 2) % front.length];
  const up = phase / SHOW;
  const yy = slot.y - 26 - up * 20;
  const a = up < 0.15 ? up / 0.15 : 1 - up;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.font = "10px 'Fusion Pixel',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(20,12,6,0.75)"; ctx.strokeText("+1", slot.x, yy);
  ctx.fillStyle = "#ffd15a"; ctx.fillText("+1", slot.x, yy);
  ctx.restore();
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
  // 老板专属陈设：沙发靠里侧墙边完整摆放 + 角落绿植
  blitCB(ctx, im.sofa, 408, 268);
  blitCB(ctx, im.plant_large, VW - 14, 276);
  // 门牌
  ctx.fillStyle = "#b4571c"; ctx.fillRect(ROOM_X + 8, WALL_H + 6, 54, 13);
  ctx.fillStyle = "#fff7e6"; ctx.font = "8px 'Fusion Pixel',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("老板办公室", ROOM_X + 35, WALL_H + 12);
}

// ===== 一天的光照：清晨柔光 → 正午最亮 → 下午金黄 → 黄昏橙 → 夜里偏蓝暗 =====
// 关键帧: [时刻, r, g, b, multiply强度, 暗角系数, 夜幕蓝强度]
const LIGHT_KF: number[][] = [
  [9, 255, 241, 216, 0.07, 0.82, 0],
  [11.5, 255, 249, 234, 0.04, 0.68, 0],
  [14.5, 255, 236, 202, 0.09, 0.82, 0],
  [17, 255, 219, 176, 0.13, 0.98, 0.02],
  [18.75, 208, 190, 200, 0.12, 1.1, 0.1],
  [21, 132, 145, 192, 0.16, 1.28, 0.2],
];
function lightAt(gh: number): number[] {
  if (gh <= LIGHT_KF[0][0]) return LIGHT_KF[0];
  for (let i = 0; i < LIGHT_KF.length - 1; i++) {
    const a = LIGHT_KF[i], b = LIGHT_KF[i + 1];
    if (gh >= a[0] && gh <= b[0]) {
      const u = (gh - a[0]) / (b[0] - a[0]);
      return a.map((v, j) => v + (b[j] - v) * u);
    }
  }
  return LIGHT_KF[LIGHT_KF.length - 1];
}

let vignette: CanvasGradient | null = null;
function postGrade(ctx: CanvasRenderingContext2D, t: number, gh: number) {
  const [, r, g, b, mult, vig, night] = lightAt(gh);
  ctx.save();
  ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${mult})`; ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = "rgba(70,50,100,0.10)"; ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = "source-over";
  if (night > 0.001) { ctx.fillStyle = `rgba(24,34,72,${night})`; ctx.fillRect(0, 0, VW, VH); }
  if (!vignette) { vignette = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.36, VW / 2, VH / 2, VH * 0.95); vignette.addColorStop(0, "rgba(20,12,28,0)"); vignette.addColorStop(1, "rgba(20,12,28,0.42)"); }
  ctx.globalAlpha = Math.min(1, vig * (0.92 + 0.08 * Math.sin(t / 1800)));
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, VW, VH);
  ctx.restore();
}

function nameTag(ctx: CanvasRenderingContext2D, cx: number, by: number, name: string, hi: boolean, done = false, off = false) {
  ctx.font = "8px 'Fusion Pixel',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = Math.max(ctx.measureText(name).width + 8, 22), x = Math.round(cx - w / 2), y = Math.round(by + 3);
  ctx.save();
  if (off) ctx.globalAlpha = 0.45; // 已下班：名牌压暗
  ctx.fillStyle = hi ? "rgba(201,93,46,0.96)" : done ? "rgba(52,116,66,0.92)" : "rgba(30,22,38,0.82)"; ctx.fillRect(x, y, Math.round(w), 12);
  ctx.fillStyle = "#f6efe2"; ctx.fillText(name, cx, y + 6);
  ctx.restore();
}
// 已问干净：头顶挂一个绿色 ✓ 徽章，替代 idle emoji 气泡
function doneBadge(ctx: CanvasRenderingContext2D, cx: number, topY: number) {
  const y = topY - 13;
  ctx.fillStyle = "#4f9d57"; ctx.fillRect(cx - 8, y, 16, 12); ctx.fillRect(cx - 2, y + 12, 3, 3);
  ctx.strokeStyle = "#2e6b38"; ctx.lineWidth = 1; ctx.strokeRect(cx - 7.5, y + 0.5, 15, 11);
  ctx.fillStyle = "#ffffff"; ctx.font = "9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✓", cx, y + 5);
}
function bubble(ctx: CanvasRenderingContext2D, cx: number, topY: number, emoji: string, hi: boolean) {
  const y = topY - 13;
  ctx.fillStyle = "#fffaf0"; ctx.fillRect(cx - 8, y, 16, 12); ctx.fillRect(cx - 2, y + 12, 3, 3);
  ctx.strokeStyle = hi ? "rgba(201,93,46,0.9)" : "rgba(40,30,50,0.4)"; ctx.lineWidth = 1; ctx.strokeRect(cx - 7.5, y + 0.5, 15, 11);
  ctx.font = "9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(emoji, cx, y + 5);
}

// ===== 同事互相搭话：每隔一会儿一对邻座冒短句对话气泡（开罗味，纯时间驱动）=====
const CHAT_PAIRS: [string, string][] = [
  ["c1", "clerk"], ["clerk", "s1"], ["s2", "c2"], ["c2", "sales"], ["manager", "clerk"], ["s1", "sales"],
];
const CHAT_LINES: [string, string][] = [
  ["截单了没？", "快了快了"], ["ETA 又改了", "啊又改?!"], ["中午吃啥", "猪脚饭走起"],
  ["客户又催了", "顶住！"], ["VGM 发了没", "这就发"], ["系统又卡了", "重启大法"],
  ["这票谁跟的", "问婷婷"], ["下班球赛看不", "加班呢…"],
];
/** 当前谁在说话：null 或 { id, line }。午休吃饭 / 傍晚陆续下班后不再闲聊。 */
function chatState(t: number, gh: number, offMap: Record<string, number | undefined>): { id: string; line: string } | null {
  if (gh >= 17.5 || (gh >= 12 && gh < 13)) return null; // 傍晚人走差不多了 / 午休——安静
  const CYC = 15_000, WIN = 5000;
  const ph = t % CYC;
  if (ph > WIN) return null;
  const i = Math.floor(t / CYC);
  const pair = CHAT_PAIRS[i % CHAT_PAIRS.length];
  // 这一对里有人下班了就不说（避免落单自言自语）
  const offH0 = offMap[pair[0]], offH1 = offMap[pair[1]];
  if ((offH0 != null && gh >= offH0) || (offH1 != null && gh >= offH1)) return null;
  const lines = CHAT_LINES[(i * 7 + 3) % CHAT_LINES.length];
  const who = ph < WIN / 2 ? 0 : 1;
  return { id: pair[who], line: lines[who] };
}
function chatBubble(ctx: CanvasRenderingContext2D, cx: number, topY: number, text: string) {
  ctx.font = "8px 'Fusion Pixel',monospace";
  const w = Math.max(ctx.measureText(text).width + 10, 24), h = 13;
  const x = Math.max(2, Math.min(VW - 2 - w, cx - w / 2)), y = topY - 14;
  ctx.fillStyle = "#fffaf0"; ctx.fillRect(x, y, w, h); ctx.fillRect(cx - 2, y + h, 3, 3);
  ctx.strokeStyle = "rgba(40,30,50,0.55)"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = "#3a2a1a"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
}

export interface DrawState { images: ImageMap; slots: NpcSlot[]; hoveredId: PersonaId | null; doneIds?: Set<PersonaId>; boost?: number; gameMs?: number; timeMs: number; }

// ===== 起身走动：每人隔一两分钟去右上角饮水机喝口水再回来（纯时间驱动，无状态）=====
const COOLER = { x: 332, y: 140 };
function easeIO(u: number) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
/** 返回 null=在工位；否则 {x,y,drinking} 当前走动位置 */
function wanderPos(slot: NpcSlot, i: number, t: number): { x: number; y: number; drinking: boolean } | null {
  if (slot.room) return null; // 老板不出办公室
  const CYC = 92_000 + i * 13_700;           // 每人周期错开，同时离席的概率低
  const ph = (t + i * 37_313) % CYC;
  const OUT = 2600, STAY = 4600, BACK = 2600;
  if (ph >= OUT + STAY + BACK) return null;
  const tx = COOLER.x + (i % 3) * 8, ty = COOLER.y - (i % 2) * 5; // 到机器旁站位错开
  const from = { x: slot.x, y: slot.y + 15 };
  let k: number, drinking = false;
  if (ph < OUT) k = easeIO(ph / OUT);
  else if (ph < OUT + STAY) { k = 1; drinking = true; }
  else k = easeIO(1 - (ph - OUT - STAY) / BACK);
  const bob = Math.sin(t / 90) * (k > 0 && k < 1 ? 1 : 0);
  return { x: from.x + (tx - from.x) * k, y: from.y + (ty - from.y) * k + bob, drinking };
}

export function drawScene(ctx: CanvasRenderingContext2D, s: DrawState) {
  const im = s.images, t = s.timeMs;
  const gh = 9 + (((s.gameMs ?? 0) / 3_600_000) % 12); // 当前游戏时刻 9..21
  const boost = s.boost ?? 0; // 提效%（彩蛋级环境反馈：订单板随诊断变好）
  ctx.clearRect(0, 0, VW, VH);
  drawFloorWalls(ctx, im, gh);
  drawOrderBoard(ctx, 96, 42,
    Math.max(4, 26 - Math.round(boost / 3)),
    18 + Math.floor(((s.gameMs ?? 0) / 3_600_000) * (2 + boost / 12)));
  drawReception(ctx);
  drawBossRoom(ctx, im);
  // 开放区陈设 + 饮水机(右上，不挡花)
  blitCB(ctx, im.plant_large, 16, VH);
  blitCB(ctx, im.plant_large, 348, VH);
  drawCooler(ctx, COOLER.x - 16, COOLER.y + 8);

  const pods = [...s.slots].sort((a, b) => a.y - b.y);
  const frame = t % 760 < 380 ? "0" : "1";
  const glow = gh >= 18.5 ? 1.9 : 1; // 夜里显示器辉光更亮
  const walkers: { slot: NpcSlot; pos: { x: number; y: number; drinking: boolean } }[] = [];
  for (let pi = 0; pi < pods.length; pi++) {
    const slot = pods[pi];
    const cx = slot.x, by = slot.y, hi = s.hoveredId === slot.id;
    const off = slot.offH != null && gh >= slot.offH; // 下过班了：人不在、显示器关了
    const away = off ? null : wanderPos(slot, s.slots.indexOf(slot), t);
    if (hi) { ctx.fillStyle = "rgba(255,220,140,0.25)"; ctx.beginPath(); ctx.ellipse(cx, by + 6, 20, 7, 0, 0, Math.PI * 2); ctx.fill(); }
    blitCB(ctx, im.desk, cx, by);
    blitCB(ctx, im.monitor, cx, by - 5);
    if (!off) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(120,210,150,${(0.06 + 0.05 * Math.sin(t / 220 + cx)) * glow})`; ctx.fillRect(cx - 6, by - 33, 12, 8); ctx.restore();
    }
    if (off) continue;
    if (away) { walkers.push({ slot, pos: away }); continue; } // 人不在工位：稍后画在最上层
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(cx, by + 15, hi ? 11 : 9, hi ? 3 : 2.5, 0, 0, Math.PI * 2); ctx.fill();
    blitCB(ctx, im[`${slot.sprite}_${frame}`], cx, by + 15, hi ? 1.06 : 1, hi ? 0.98 : 1);
  }
  // 离席走动的人（画在家具之上）
  for (const w of walkers.sort((a, b) => a.pos.y - b.pos.y)) {
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(w.pos.x, w.pos.y, 9, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    blitCB(ctx, im[`${w.slot.sprite}_${frame}`], w.pos.x, w.pos.y);
    if (w.pos.drinking) {
      ctx.font = "9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText((s.slots.indexOf(w.slot) % 2) ? "☕" : "🚰", w.pos.x + 10, w.pos.y - 22);
    }
  }
  postGrade(ctx, t, gh);
  const lunch = gh >= 12 && gh < 13;
  const offMap: Record<string, number | undefined> = {};
  for (const sl of s.slots) offMap[sl.id] = sl.offH;
  const cs = chatState(t, gh, offMap); // 谁在跟邻座搭话
  for (const slot of pods) {
    const cx = slot.x, by = slot.y, hi = s.hoveredId === slot.id;
    const done = s.doneIds?.has(slot.id) ?? false;
    const off = slot.offH != null && gh >= slot.offH;
    const away = off ? null : wanderPos(slot, s.slots.indexOf(slot), t);
    if (hi) { ctx.strokeStyle = "rgba(255,214,140,0.9)"; ctx.lineWidth = 1; ctx.strokeRect(cx - 13, by - 6, 26, 24); }
    const topY = by - 3 + (frame === "1" ? -1 : 0);
    // 午休吃饭/晚上加班的表情覆盖
    let em = slot.emoji;
    if (lunch) em = ["🍚", "🍜", "😴", "🍵"][(slot.x + slot.y) % 4];
    else if (gh >= 19 && (slot.x + slot.y) % 3 === 0) em = "☕";
    if (!off) {
      if (done) doneBadge(ctx, cx, topY);
      else if (!away) {
        if (cs && cs.id === slot.id) chatBubble(ctx, cx, topY, cs.line);
        else bubble(ctx, cx, topY, em, hi);
      }
    }
    nameTag(ctx, cx, by + 16, slot.name, hi, done, off);
  }
  orderPop(ctx, s.slots, t, gh);
}

export function hitTest(slots: NpcSlot[], vx: number, vy: number): PersonaId | null {
  for (const slot of slots) if (vx >= slot.x - 15 && vx <= slot.x + 15 && vy >= slot.y - 32 && vy <= slot.y + 18) return slot.id;
  return null;
}
