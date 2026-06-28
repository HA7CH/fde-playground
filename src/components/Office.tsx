"use client";

import { useEffect, useRef, useState } from "react";
import { PERSONAS } from "@/lib/personas";
import type { PersonaId } from "@/lib/types";
import { VW, VH, SLOTS, SPRITE_FILES, drawScene, hitTest, type ImageMap, type NpcSlot } from "./office-draw";

const slots: NpcSlot[] = SLOTS.map((s) => {
  const p = PERSONAS[s.id];
  return { ...s, name: p.title, emoji: p.emoji };
});

function loadImages(): Promise<ImageMap> {
  const entries = Object.entries(SPRITE_FILES);
  return Promise.all(
    entries.map(
      ([key, src]) =>
        new Promise<[string, HTMLImageElement]>((resolve) => {
          const im = new Image();
          im.onload = () => resolve([key, im]);
          im.onerror = () => resolve([key, im]); // 失败也 resolve，渲染时跳过
          im.src = src;
        }),
    ),
  ).then((pairs) => Object.fromEntries(pairs));
}

export default function Office({ onSelect }: { onSelect: (id: PersonaId) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<PersonaId | null>(null);
  const scaleRef = useRef(2);
  const [cursorPointer, setCursorPointer] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let raf = 0;
    let ro: ResizeObserver | null = null;
    let cancelled = false;

    loadImages().then((images) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      setReady(true);

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const avail = wrap.clientWidth || VW;
        const scale = Math.max(1, Math.min(5, Math.floor(avail / VW)));
        scaleRef.current = scale;
        canvas.width = VW * scale * dpr;
        canvas.height = VH * scale * dpr;
        canvas.style.width = `${VW * scale}px`;
        canvas.style.height = `${VH * scale}px`;
        ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
      };

      const loop = (t: number) => {
        drawScene(ctx, { images, slots, hoveredId: hoverRef.current, timeMs: t });
        raf = requestAnimationFrame(loop);
      };

      resize();
      raf = requestAnimationFrame(loop);
      ro = new ResizeObserver(resize);
      ro.observe(wrap);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  const toVirtual = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const s = scaleRef.current;
    return { vx: (clientX - rect.left) / s, vy: (clientY - rect.top) / s };
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
    if (hit) onSelect(hit);
  };

  return (
    <div ref={wrapRef} className="office-wrap">
      <canvas
        ref={canvasRef}
        className="office-canvas"
        style={{ cursor: cursorPointer ? "pointer" : "default", opacity: ready ? 1 : 0 }}
        onPointerMove={onMove}
        onPointerDown={onClick}
        onPointerLeave={() => {
          hoverRef.current = null;
          setCursorPointer(false);
        }}
      />
      <p className="office-hint">点工位上的同事，跟他聊 · 摸清这家货代到底卡在哪</p>
    </div>
  );
}
