"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NPCS, OFF_DUTY, ROSTER } from "@/lib/personas";
import type { PersonaId } from "@/lib/types";
import { VW, VH, SPRITE_FILES, drawScene, hitTest, type ImageMap, type NpcSlot } from "./office-draw";

const slots: NpcSlot[] = ROSTER.map((r) => {
  const p = NPCS[r.id];
  return { id: r.id, x: r.x, y: r.y, room: r.room, name: p.name.split("（")[0], emoji: p.emoji, sprite: p.sprite ?? "clerk", offH: OFF_DUTY[r.id] };
});

function loadImages(): Promise<ImageMap> {
  return Promise.all(
    Object.entries(SPRITE_FILES).map(
      ([key, src]) =>
        new Promise<[string, HTMLImageElement]>((resolve) => {
          const im = new Image();
          im.onload = () => resolve([key, im]);
          im.onerror = () => resolve([key, im]);
          im.src = src;
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs));
}

export default function Office({
  onSelect,
  found = new Set(),
  interactive = true,
  boost = 0,
  gameMs = 0,
}: {
  onSelect?: (id: PersonaId) => void;
  found?: Set<string>;
  interactive?: boolean;
  /** 团队提效 %（彩蛋级环境反馈：订单板随之变好） */
  boost?: number;
  /** 游戏内时间(游戏 ms)，驱动光照/挂钟/作息；rAF 帧间自行外推 */
  gameMs?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<PersonaId | null>(null);
  const doneRef = useRef<Set<PersonaId>>(new Set());
  const boostRef = useRef(0);
  useEffect(() => { boostRef.current = boost; }, [boost]);
  const gameRef = useRef({ ms: 0, at: 0, live: false });
  useEffect(() => { gameRef.current = { ms: gameMs, at: performance.now(), live: gameMs > 0 }; }, [gameMs]);
  const smoothRef = useRef(0); // 平滑追踪的游戏时间——⏩ 快进时光照/挂钟连续快转而非瞬跳
  const [cursorPointer, setCursorPointer] = useState(false);
  const [ready, setReady] = useState(false);

  // 哪些同事已被"问干净"（自己的线索全部进了笔记本）→ 头顶挂 ✓。干扰角色无线索，永不标记。
  const doneIds = useMemo(() => {
    const d = new Set<PersonaId>();
    for (const slot of slots) {
      const cs = NPCS[slot.id]?.clues ?? [];
      if (cs.length > 0 && cs.every((c) => found.has(c.id))) d.add(slot.id);
    }
    return d;
  }, [found]);
  useEffect(() => { doneRef.current = doneIds; }, [doneIds]);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    loadImages().then((images) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // 固定超采样背景，CSS 拉满宽度 → 始终大且像素清晰
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const S = 3;
      canvas.width = VW * S * dpr;
      canvas.height = VH * S * dpr;
      ctx.setTransform(S * dpr, 0, 0, S * dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      setReady(true);
      const loop = (t: number) => {
        const g = gameRef.current;
        const target = g.live ? g.ms + (t - g.at) * 60 : g.ms; // 1 现实 ms = 60 游戏 ms，帧间外推
        // 平滑追赶：快进 +1h 时天色/挂钟在 ~1s 内连续快转（更逼真），初始/重开则直接贴齐
        let sm = smoothRef.current;
        if (sm === 0 || target < sm || target - sm > 6 * 3_600_000) sm = target;
        else { sm += (target - sm) * 0.06; if (target - sm < 30_000) sm = target; }
        smoothRef.current = sm;
        drawScene(ctx, { images, slots, hoveredId: hoverRef.current, doneIds: doneRef.current, boost: boostRef.current, gameMs: sm, timeMs: t });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, []);

  const toVirtual = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { vx: ((clientX - rect.left) / rect.width) * VW, vy: ((clientY - rect.top) / rect.height) * VH };
  };
  const onMove = (e: React.PointerEvent) => {
    const { vx, vy } = toVirtual(e.clientX, e.clientY);
    const hit = hitTest(slots, vx, vy);
    hoverRef.current = hit;
    setCursorPointer(Boolean(hit));
  };
  const onClick = (e: React.PointerEvent) => {
    const { vx, vy } = toVirtual(e.clientX, e.clientY);
    const hit = hitTest(slots, vx, vy);
    if (hit) onSelect?.(hit);
  };

  return (
    <div className="office-wrap">
      <canvas
        ref={canvasRef}
        className={`office-canvas${interactive ? "" : " ambient"}`}
        style={{ cursor: interactive && cursorPointer ? "pointer" : "default", opacity: ready ? 1 : 0 }}
        onPointerMove={interactive ? onMove : undefined}
        onPointerDown={interactive ? onClick : undefined}
        onPointerLeave={interactive ? () => { hoverRef.current = null; setCursorPointer(false); } : undefined}
      />
    </div>
  );
}
