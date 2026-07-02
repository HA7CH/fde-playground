// 视觉抖动：给某个元素来一段衰减位移，制造"冲击感"。用 Web Animations API，不改布局。
// 尊重 prefers-reduced-motion：用户要求减少动效时直接跳过。
export function shake(el: HTMLElement | null, mag = 6, dur = 350) {
  if (!el || typeof window === "undefined") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const steps = 10;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const d = mag * (1 - i / steps);
    frames.push({ transform: `translate(${(Math.random() * 2 - 1) * d}px, ${(Math.random() * 2 - 1) * d}px)` });
  }
  try { el.animate(frames, { duration: dur, easing: "ease-out" }); } catch { /* ignore */ }
}
