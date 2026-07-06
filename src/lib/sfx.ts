// 程序化音效：WebAudio 现场合成，无需素材文件，零版权、体积为 0。仅客户端。
// 风格参考 ryOS(ryokun6/ryos) 的经典 Mac UI 音：清脆、有个性、分门别类——
// 用「钟/铃泛音 + 带通噪声咔哒 + ADSR 包络」合成，比纯方波 blip 精致得多。
// 首次 play 发生在用户点击之内 → 满足移动端 autoplay 解锁。静音状态存 localStorage。

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
      master.gain.value = 0.42;
      master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// 单振荡器音，带 ADSR（指数衰减，收尾干净）
function osc(o: { freq: number; dur: number; t0?: number; type?: OscillatorType; gain?: number; detune?: number; attack?: number; slideTo?: number }) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + (o.t0 ?? 0);
  const O = ctx.createOscillator();
  const g = ctx.createGain();
  O.type = o.type ?? "sine";
  O.frequency.setValueAtTime(o.freq, t);
  if (o.slideTo) O.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t + o.dur);
  if (o.detune) O.detune.setValueAtTime(o.detune, t);
  const peak = o.gain ?? 0.25;
  const a = o.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  O.connect(g); g.connect(master);
  O.start(t); O.stop(t + o.dur + 0.03);
}

// 钟/铃：基频 + 两个略不谐泛音，指数衰减 → 清脆有金属感
function bell(freq: number, t0: number, dur: number, gain = 0.2) {
  osc({ freq, t0, dur, type: "sine", gain, attack: 0.004 });
  osc({ freq: freq * 2.01, t0, dur: dur * 0.7, type: "sine", gain: gain * 0.5, attack: 0.004 });
  osc({ freq: freq * 3.03, t0, dur: dur * 0.42, type: "sine", gain: gain * 0.22, attack: 0.004 });
}

// 噪声脉冲经滤波 → 「咔哒 / 闷响」点击质感
function noise(o: { dur: number; t0?: number; gain?: number; freq?: number; q?: number; type?: BiquadFilterType }) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + (o.t0 ?? 0);
  const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? "bandpass"; f.frequency.value = o.freq ?? 1800; f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const peak = o.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + o.dur + 0.02);
}

const SOUNDS = {
  // 打开对话 / 进办公室：轻咔哒 + 上行双铃（"开窗"感）
  open: () => { noise({ dur: 0.03, gain: 0.11, freq: 2600, q: 0.7 }); bell(660, 0, 0.28, 0.15); bell(990, 0.04, 0.34, 0.12); },
  // 关闭对话框 / 弹窗：下行双铃 + 轻咔哒（"关窗"感）
  close: () => { noise({ dur: 0.025, gain: 0.1, freq: 1500, q: 0.8 }); bell(620, 0, 0.2, 0.13); bell(415, 0.05, 0.24, 0.12); },
  // 发消息：干脆的"按下"click（带通噪声 + 一点点方波）
  send: () => { noise({ dur: 0.022, gain: 0.16, freq: 2200, q: 0.9 }); osc({ freq: 1000, dur: 0.05, type: "square", gain: 0.05 }); },
  // 收到回复：温柔双铃（"新消息"）
  receive: () => { bell(523, 0, 0.22, 0.13); bell(784, 0.05, 0.26, 0.11); },
  // 普通线索入袋：清脆钟声
  clue: () => { bell(659, 0, 0.5, 0.19); bell(988, 0.08, 0.5, 0.13); },
  // ★ 核心线索：更亮的三音钟 + 一点高频 sparkle
  clueKey: () => { bell(659, 0, 0.6, 0.21); bell(988, 0.09, 0.6, 0.17); bell(1319, 0.18, 0.55, 0.12); noise({ t0: 0.2, dur: 0.05, gain: 0.05, freq: 6500, q: 0.5 }); },
  // 某人问干净：完成琶音钟
  done: () => { [523, 659, 784, 1047].forEach((f, i) => bell(f, i * 0.09, 0.5, 0.19)); },
  // 老板酒局：低沉下沉 swell + 闷响（不祥/戏剧）
  event: () => { osc({ freq: 220, dur: 0.7, type: "sawtooth", gain: 0.19, slideTo: 70 }); osc({ freq: 110, dur: 0.65, type: "square", gain: 0.11 }); noise({ dur: 0.28, gain: 0.13, freq: 220, q: 0.6, type: "lowpass" }); },
  // 小红书邀请：上行四音 + 闪
  share: () => { [659, 880, 1047, 1319].forEach((f, i) => bell(f, i * 0.07, 0.4, 0.15)); noise({ t0: 0.3, dur: 0.06, gain: 0.05, freq: 7000, q: 0.4 }); },
  // 诊断出结果：低回上扬两音，如"定音"
  diagnose: () => { bell(392, 0, 0.7, 0.2); bell(523, 0.13, 0.7, 0.15); },
  // 通用点击（开关/复制）
  ui: () => { noise({ dur: 0.02, gain: 0.12, freq: 2000, q: 1.2 }); },
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
