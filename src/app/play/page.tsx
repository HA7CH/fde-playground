"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Office from "@/components/Office";
import Dialogue from "@/components/Dialogue";
import DiagnoseModal from "@/components/DiagnoseModal";
import ShareModal from "@/components/ShareModal";
import SoundToggle from "@/components/SoundToggle";
import GitHubLink from "@/components/GitHubLink";
import { ALL_CLUES, KEY_CLUE_IDS, NPCS } from "@/lib/personas";
import type { ChatMessage, PersonaId } from "@/lib/types";
import { sfx } from "@/lib/sfx";

const STORE_KEY = "fde-play-v1"; // localStorage 键（改结构就 bump 版本）

function newSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/** 毫秒 → m:ss */
function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ===== 游戏时间系统：1 现实秒 = 1 游戏分钟；每天 9:00 上班 → 21:00 收工（自动跳次日早 9 点）=====
const GAME_SPEED = 60;                 // 现实 1ms = 游戏 60ms
const GH = 3_600_000;                  // 1 游戏小时（游戏 ms）
const DAY_START = 9, DAY_END = 21, DAY_LEN = DAY_END - DAY_START;
// 订单节奏（可调）：开局旧账 14；9:00 早高峰 +12、13:00 午后 +8；团队全天消化 2 单/游戏小时（午休 12-13 停）；每条★核心线索 −6
const BASE_BACKLOG = 14, BURST_AM = 12, BURST_PM = 8, DIGEST_PER_H = 2, CLUE_RELIEF = 6;
// 积压堆到这个数还没什么进展 → 老板主动出来堵你（第1天午后无★≈26 会触发；挖到1条★=20 不会）
const BOSS_PUSH_AT = 24;
const BOSS_PUSH_MSG = "（李总从里间冲出来，把一沓单子拍在你桌上）小伙子，你自己看看——处理中都堆成山了！我请你来是把事捋顺的，不是陪大家聊天的。给我句准话：问题到底出在哪？多久能见效？";

function gameClock(gameMs: number) {
  const totalH = gameMs / GH;
  return { day: Math.floor(totalH / DAY_LEN) + 1, hod: DAY_START + (totalH % DAY_LEN) };
}
function fmtClock(hod: number) {
  const h = Math.floor(hod), m = Math.floor((hod - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
/** 开工以来净新增订单（高峰进单 − 团队消化），gameMs 的纯函数，可随存档恢复 */
function netOrders(gameMs: number) {
  const dayNet = BURST_AM + BURST_PM - DIGEST_PER_H * (DAY_LEN - 1); // 午休 1h 不消化 → 每天净 −2（干等也能慢慢变好）
  const fullDays = Math.floor(gameMs / (DAY_LEN * GH));
  const hod = DAY_START + (gameMs % (DAY_LEN * GH)) / GH;
  const bursts = BURST_AM + (hod >= 13 ? BURST_PM : 0);
  const digestH = Math.min(hod, 12) - DAY_START + Math.max(0, Math.min(hod, DAY_END) - 13);
  return fullDays * dayNet + bursts - DIGEST_PER_H * digestH;
}

export default function Play() {
  const [sessionId, setSessionId] = useState("");
  const [active, setActive] = useState<PersonaId | null>(null);
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});
  const [found, setFound] = useState<Set<string>>(new Set());
  const [diagnose, setDiagnose] = useState(false);
  // 事件：满 N 条线索触发一次性弹窗。pending = 已触发待开场；fired 保证一次性。
  const [firedEvents, setFiredEvents] = useState<Set<string>>(new Set());
  const [pendingEvent, setPendingEvent] = useState<PersonaId | null>(null);
  const [pendingShare, setPendingShare] = useState(false);
  const [manualShare, setManualShare] = useState(false); // 顶栏「分享」按钮随时打开
  const [hydrated, setHydrated] = useState(false); // 从 localStorage 恢复完成前，别回写覆盖
  const [startedAt, setStartedAt] = useState<number | null>(null); // 首次点开同事时开始计时（持久化，刷新不重置）
  const [nowTs, setNowTs] = useState(0); // 当前时间戳，每秒 tick 刷新计时显示
  const [skipMs, setSkipMs] = useState(0); // ⏩ +1h 快进累计的游戏毫秒（持久化）
  const [dayToast, setDayToast] = useState<number | null>(null); // 换日横幅

  // 恢复上次进度（仅客户端）。sessionId 也持久化——同一玩家多次会话串成一条采集记录。
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const s = raw ? JSON.parse(raw) : null;
      setSessionId(s?.sessionId || newSessionId());
      if (s?.histories) setHistories(s.histories);
      if (Array.isArray(s?.found)) setFound(new Set(s.found));
      if (Array.isArray(s?.firedEvents)) setFiredEvents(new Set(s.firedEvents));
      if (typeof s?.startedAt === "number") setStartedAt(s.startedAt);
      if (typeof s?.skipMs === "number") setSkipMs(s.skipMs);
    } catch {
      setSessionId(newSessionId());
    }
    setNowTs(Date.now());
    setHydrated(true);
  }, []);

  // 持久化进度（Set 存成数组）
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        sessionId, histories, found: [...found], firedEvents: [...firedEvents], startedAt, skipMs,
      }));
    } catch { /* 隐私模式/超额，忽略 */ }
  }, [hydrated, sessionId, histories, found, firedEvents, startedAt, skipMs]);

  // 计时：首次点开同事后每秒刷新显示
  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsedMs = startedAt != null ? Math.max(0, nowTs - startedAt) : 0;
  const gameMs = startedAt != null ? elapsedMs * GAME_SPEED + skipMs : 0;
  const { day, hod } = gameClock(gameMs);
  const shownElapsedMs = elapsedMs + skipMs / GAME_SPEED; // ⏩ 快进的钟点也算进你的用时（战绩公平）

  const talkedCount = Object.keys(histories).filter((id) => (histories[id] ?? []).some((m) => m.role === "user")).length;
  const keyFound = [...found].filter((id) => KEY_CLUE_IDS.includes(id)).length;
  // 积压 = 开局旧账 + 订单节奏（高峰进单、团队全天消化、午休停）− 每条★核心痛点×6。
  // 两条清法：挖到★立减（诊断对=团队真提效）、或等时间/⏩快进让团队自己消化。只是面子分，不卡任何门槛。
  const backlog = startedAt != null ? Math.max(0, Math.floor(BASE_BACKLOG + netOrders(gameMs) - keyFound * CLUE_RELIEF)) : 0;
  const total = ALL_CLUES.length;
  const ready = talkedCount >= 2 || found.size >= 3;

  // 收工换日：21:00 自动跳到次日早 9 点，弹一条横幅（null 起始 → 刷新恢复存档时不误弹）
  const dayRef = useRef<number | null>(null);
  useEffect(() => {
    if (startedAt == null) { dayRef.current = null; return; }
    const prev = dayRef.current;
    dayRef.current = day;
    if (prev != null && day > prev) {
      setDayToast(day);
      sfx("done");
      const id = setTimeout(() => setDayToast(null), 4200);
      return () => clearTimeout(id);
    }
  }, [day, startedAt]);

  const skipHour = () => {
    if (startedAt == null) return;
    sfx("ui");
    setSkipMs((s) => s + GH);
  };

  // 作息音效提醒：12:00 午休铃 / 13:00 回工位 / 18:00 下班铃(进加班时段)
  const hourRef = useRef<number | null>(null);
  useEffect(() => {
    if (startedAt == null) { hourRef.current = null; return; }
    const h = Math.floor(hod);
    const prev = hourRef.current;
    hourRef.current = h;
    if (prev == null || h === prev) return;
    if (h === 12) sfx("receive");
    else if (h === 13) sfx("ui");
    else if (h === 18) sfx("receive");
  }, [hod, startedAt]);

  const addClues = (ids: string[]) => {
    const fresh = ids.filter((i) => !found.has(i));
    if (fresh.length) sfx(fresh.some((i) => KEY_CLUE_IDS.includes(i)) ? "clueKey" : "clue");
    setFound((s) => { const n = new Set(s); ids.forEach((i) => n.add(i)); return n; });
  };

  // 集满 3 条线索 → 邀请发小红书（传播钩子）。只触发一次（firedEvents 已持久化，刷新也不再弹）。
  useEffect(() => {
    if (found.size >= 3 && !firedEvents.has("share")) {
      setFiredEvents((s) => new Set(s).add("share"));
      setPendingShare(true);
    }
  }, [found, firedEvents]);

  // 集满 5 条线索 → 老板拉你喝酒（off-record）。只触发一次。（5=测试值，正式给候选人前可调回 8）
  useEffect(() => {
    if (found.size >= 5 && !firedEvents.has("drinks")) {
      setFiredEvents((s) => new Set(s).add("drinks"));
      setPendingEvent("boss_offrecord");
    }
  }, [found, firedEvents]);

  // NPC 主动来找你（通用管道：往 TA 的聊天记录里注入一条"走过来"的开场白 + 自动弹开对话）。
  // 用例1：积压堆到 BOSS_PUSH_AT 还没进展 → 老板出来堵你催准话（白天版"酒桌逼单"，看你敢不敢顶住不过度承诺）。
  useEffect(() => {
    if (startedAt == null || backlog < BOSS_PUSH_AT || firedEvents.has("bosspush")) return;
    if (active || pendingEvent || pendingShare || diagnose) return; // 不打断进行中的对话/弹窗
    setFiredEvents((s) => new Set(s).add("bosspush"));
    setHistories((h) => ({ ...h, boss: [...(h.boss ?? []), { role: "assistant" as const, content: BOSS_PUSH_MSG }] }));
    setActive("boss");
    sfx("event");
  }, [backlog, startedAt, firedEvents, active, pendingEvent, pendingShare, diagnose]);

  const restart = () => {
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    setActive(null); setHistories({}); setFound(new Set()); setFiredEvents(new Set());
    setPendingEvent(null); setPendingShare(false); setManualShare(false); setDiagnose(false);
    setStartedAt(null); setNowTs(Date.now()); setSkipMs(0); setDayToast(null);
    setSessionId(newSessionId());
  };

  return (
    <div className="invest">
      {/* 顶部：身份 + 目标 + 进度 */}
      <div className="invest-top panel">
        <div className="brand">
          <span className="ico">✈</span>
          <span className="t"><b>FDE Playground</b><span>货代驻场摸需求实战</span></span>
        </div>
        <div className="obj">🎯 <b>目标</b>：摸清这家货代<b>最该先解决</b>的真痛点</div>
        <div className="prog">
          <span>🗣 已聊 <b>{talkedCount}</b> 人</span>
          <span>🔍 线索 <b>{found.size}</b>/{total}</span>
          <span>⏱ <b>{fmt(shownElapsedMs)}</b></span>
          <span title="游戏内时间：9:00 上班 · 12:00-13:00 午休 · 21:00 收工自动跳次日早上">
            {hod >= 19 ? "🌙" : hod >= 12 && hod < 13 ? "🍚" : "🕘"} 第{day}天 <b>{fmtClock(hod)}</b>
          </span>
          <span className={backlog >= 20 ? "prog-warn" : ""} title="早晚高峰会进单、团队全天消化（午休停）。挖到★核心痛点立减，或 ⏩ 快进等团队慢慢清">📦 积压 <b>{backlog}</b> 单</span>
          <button className="restart-btn" onClick={skipHour} disabled={startedAt == null} title="快进 1 小时：让团队干会儿活消化订单（会算进你的用时）">⏩ +1h</button>
          <button className="restart-btn" onClick={() => { sfx("ui"); setManualShare(true); }} title="把当前战绩分享到小红书">📤 分享</button>
          <SoundToggle className="restart-btn" />
          <button className="restart-btn" onClick={restart} title="清空进度重新开始">↻ 重开</button>
        </div>
      </div>

      {/* 主体：办公室 + 线索笔记本 */}
      <div className="invest-body">
        <div className="stage">
          <Office onSelect={(id) => { sfx("open"); const t = Date.now(); setStartedAt((v) => v ?? t); setNowTs(t); setActive(id); }} found={found} backlog={backlog} gameMs={gameMs} />
        </div>

        <aside className="note panel">
          <div className="card-h">🔍 线索笔记本　<span style={{ float: "right", color: "var(--ink2)" }}>{found.size}/{total}</span></div>
          <div className="note-list">
            {ALL_CLUES.map((c) => {
              const got = found.has(c.id);
              return (
                <div key={c.id} className={`note-row ${got ? "got" : "locked"}`}>
                  <span className="mk">{got ? (c.key ? "★" : "✓") : "·"}</span>
                  <span className="tx">{got ? c.label : "？？？ 还没问出来"}</span>
                  {got && <span className="src">{c.ownerName}</span>}
                </div>
              );
            })}
          </div>
          <div className="note-foot">★ = 核心痛点线索　·　点办公室里的同事问出更多</div>
        </aside>
      </div>

      {/* 底部：唯一主行动 */}
      <div className="invest-cta">
        <span className="cta-hint">
          {ready ? "差不多摸清了？把你的诊断交给主管。" : "先多跟几个同事聊聊，集齐线索再下结论。"}
        </span>
        <button className="btn btn-accent cta-btn" disabled={!ready} onClick={() => { sfx("diagnose"); setDiagnose(true); }}>
          📝 提交你的诊断
        </button>
      </div>

      <Link href="/" className="exit-link">← 退出</Link>
      <GitHubLink />

      {/* 换日横幅：21:00 收工 → 次日早 9 点 */}
      {dayToast != null && (
        <div className="day-toast panel">🌙 昨晚加完班收了工 · ☀️ 第 {dayToast} 天早上，接着摸</div>
      )}

      {active && (
        <Dialogue
          persona={NPCS[active]}
          sessionId={sessionId}
          seed={histories[active] ?? []}
          found={found}
          onPersist={(msgs) => setHistories((h) => ({ ...h, [active]: msgs }))}
          onClues={addClues}
          onClose={() => setActive(null)}
        />
      )}
      {/* 分享弹窗：集满 3 条自动弹一次 + 顶栏「📤 分享」随时手动打开（数字都取当下战绩） */}
      {(pendingShare || manualShare) && !active && !pendingEvent && (
        <ShareModal foundCount={found.size} timeLabel={fmt(shownElapsedMs)} day={day} backlog={backlog} onClose={() => { setPendingShare(false); setManualShare(false); }} />
      )}
      {/* 事件：老板酒局。等玩家聊完当前同事（active 为空）再开场，不叠在普通对话上 */}
      {pendingEvent && !active && (
        <Dialogue
          persona={NPCS[pendingEvent]}
          sessionId={sessionId}
          seed={histories[pendingEvent] ?? []}
          found={found}
          onPersist={(msgs) => setHistories((h) => ({ ...h, [pendingEvent]: msgs }))}
          onClues={() => { /* 酒局不进笔记本：信号在对话本身，已入库供回看 */ }}
          onClose={() => setPendingEvent(null)}
          event={{
            backdropClass: "event-drinks",
            caption: "🍻 下班后 · 老地方大排档。李总多喝了两杯，话比白天多……（这段也会被记录）",
          }}
        />
      )}
      {diagnose && (
        <DiagnoseModal sessionId={sessionId} foundClues={[...found]} onClose={() => setDiagnose(false)} />
      )}
    </div>
  );
}
