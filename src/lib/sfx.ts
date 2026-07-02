// 轻量程序化音效：WebAudio 现场合成复古 blip，无需任何素材文件，零版权、体积为 0。
// 仅客户端。首次 play 发生在用户点击之内 → 满足移动端 autoplay 解锁。
// 静音状态存 localStorage（配合游戏存档）。参考体感：开罗游戏 / ryOS 的清脆交互反馈。

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const listeners = new Set<() => void>();
const MUTE_KEY = "fde-sfx-muted";

if (typeof window !== "undefined") {
  try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { /* ignore */ }
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(o: { freq: number; dur: number; type?: OscillatorType; gain?: number; t0?: number; slideTo?: number }) {
  if (!ctx || !master) return;
  const now = ctx.currentTime + (o.t0 ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? "square";
  osc.frequency.setValueAtTime(o.freq, now);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), now + o.dur);
  const peak = o.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + o.dur);
  osc.connect(g); g.connect(master);
  osc.start(now); osc.stop(now + o.dur + 0.03);
}

function seq(freqs: number[], gap: number, type: OscillatorType = "square", gain = 0.24) {
  freqs.forEach((f, i) => tone({ freq: f, dur: gap * 0.92, type, gain, t0: i * gap }));
}

// 音名（Hz）
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;

const SOUNDS = {
  open: () => seq([440, 660], 0.055, "square", 0.2),                 // 打开对话
  send: () => tone({ freq: 880, dur: 0.05, type: "square", gain: 0.14 }), // 发消息
  receive: () => tone({ freq: 430, dur: 0.08, type: "triangle", gain: 0.16 }), // 收到回复
  clue: () => seq([C5, E5], 0.085, "square", 0.22),                 // 普通线索入袋
  clueKey: () => seq([C5, E5, G5], 0.085, "square", 0.26),          // ★ 核心线索
  done: () => seq([C5, E5, G5, C6], 0.075, "square", 0.24),         // 某人问干净
  event: () => { tone({ freq: 300, dur: 0.55, type: "sawtooth", gain: 0.26, slideTo: 90 }); tone({ freq: 150, dur: 0.5, type: "square", gain: 0.18, t0: 0.04 }); }, // 老板酒局
  share: () => seq([E5, G5, C6], 0.08, "triangle", 0.24),           // 小红书邀请
  diagnose: () => seq([G5, C5], 0.13, "sine", 0.22),                // 提交诊断
  ui: () => tone({ freq: 660, dur: 0.03, type: "square", gain: 0.12 }), // 通用点击
} as const;

export type SfxName = keyof typeof SOUNDS;

export function sfx(name: SfxName) {
  if (muted) return;
  if (!ensure()) return;
  try { SOUNDS[name](); } catch { /* ignore */ }
}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* ignore */ }
  if (!muted) { ensure(); sfx("ui"); }
  listeners.forEach((l) => l());
  return muted;
}

export function subscribeMute(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
