"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Office from "@/components/Office";
import Dialogue from "@/components/Dialogue";
import DiagnoseModal from "@/components/DiagnoseModal";
import ExportModal from "@/components/ExportModal";
import ShareModal from "@/components/ShareModal";
import SoundToggle from "@/components/SoundToggle";
import GitHubLink from "@/components/GitHubLink";
import { ALL_CLUES, KEY_CLUE_IDS, NPCS, OFF_DUTY } from "@/lib/personas";
import type { ChatMessage, PersonaId } from "@/lib/types";
import { sfx } from "@/lib/sfx";
import type { SessionTimelineEntry } from "@/lib/sessionExport";

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
// 提效：每挖到一条★核心痛点，团队效率 +8%（你在真的帮这家公司提效——订单板跟着变好）
const BOOST_PER_KEY = 8;
// 进展太慢 → 老板主动出来催（第 1 天 15:00 还没挖到★，或次日以后仍原地踏步；每天最多一次）
const BOSS_PUSH_MSG = "（李总从里间踱出来，敲了敲你的桌边）小伙子，来了也有阵子了吧？我可听阿强说你就四处转了转……说说，摸出个所以然没有？别绕弯子，我就要句实在话：问题到底出在哪？";

function gameClock(gameMs: number) {
  const totalH = gameMs / GH;
  return { day: Math.floor(totalH / DAY_LEN) + 1, hod: DAY_START + (totalH % DAY_LEN) };
}
function fmtClock(hod: number) {
  const h = Math.floor(hod), m = Math.floor((hod - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function initialTimeline(histories: Record<string, ChatMessage[]> = {}): SessionTimelineEntry[] {
  const now = Date.now();
  const entries: SessionTimelineEntry[] = [
    { id: `t_${now}_start`, type: "session_start", realTs: now, gameDay: 1, gameTime: "09:00" },
  ];
  Object.entries(histories).forEach(([npcId, msgs], groupIndex) => {
    if (!Array.isArray(msgs) || !msgs.length) return;
    const npcName = NPCS[npcId]?.name ?? npcId;
    entries.push({
      id: `t_${now}_legacy_${groupIndex}`,
      type: "npc_open",
      realTs: now + groupIndex,
      gameDay: 1,
      gameTime: "09:00",
      npcId,
      npcName,
      title: "旧存档对话导入（原始时间不可用）",
    });
    msgs.forEach((m, i) => {
      entries.push({
        id: `t_${now}_legacy_${groupIndex}_${i}`,
        type: "message",
        realTs: now + groupIndex + i + 1,
        gameDay: 1,
        gameTime: "09:00",
        npcId,
        npcName,
        role: m.role,
        content: m.content,
      });
    });
  });
  return entries;
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
  const [exportOpen, setExportOpen] = useState(false);
  const [timeline, setTimeline] = useState<SessionTimelineEntry[]>([]);
  const [hydrated, setHydrated] = useState(false); // 从 localStorage 恢复完成前，别回写覆盖
  const [startedAt, setStartedAt] = useState<number | null>(null); // 首次点开同事时开始计时（持久化，刷新不重置）
  const [nowTs, setNowTs] = useState(0); // 当前时间戳，每秒 tick 刷新计时显示
  const [skipMs, setSkipMs] = useState(0); // ⏩ +1h 快进累计的游戏毫秒（持久化）
  const [chatMs, setChatMs] = useState(0); // 聊天累计时长——聊天不吃游戏钟（开罗铁律），持久化
  const [dayToast, setDayToast] = useState<number | null>(null); // 换日横幅
  const [npcToast, setNpcToast] = useState<string | null>(null); // "TA 下班了"之类的小提示
  const [noteOpen, setNoteOpen] = useState(true); // 线索板折叠（手机默认收起）

  // 恢复上次进度（仅客户端）。sessionId 也持久化——同一玩家多次会话串成一条采集记录。
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const s = raw ? JSON.parse(raw) : null;
      const sid = s?.sessionId || newSessionId();
      const savedHistories = s?.histories && typeof s.histories === "object" ? s.histories : {};
      setSessionId(sid);
      if (s?.histories) setHistories(savedHistories);
      if (Array.isArray(s?.found)) setFound(new Set(s.found));
      if (Array.isArray(s?.firedEvents)) setFiredEvents(new Set(s.firedEvents));
      if (Array.isArray(s?.timeline)) {
        setTimeline(s.timeline);
      } else {
        setTimeline(initialTimeline(savedHistories));
      }
      if (typeof s?.startedAt === "number") setStartedAt(s.startedAt);
      if (typeof s?.skipMs === "number") setSkipMs(s.skipMs);
      if (typeof s?.chatMs === "number") setChatMs(s.chatMs);
    } catch {
      setSessionId(newSessionId());
      setTimeline(initialTimeline());
    }
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches) setNoteOpen(false);
    setNowTs(Date.now());
    setHydrated(true);
  }, []);

  // 持久化进度（Set 存成数组）
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        sessionId, histories, found: [...found], firedEvents: [...firedEvents], timeline, startedAt, skipMs, chatMs,
      }));
    } catch { /* 隐私模式/超额，忽略 */ }
  }, [hydrated, sessionId, histories, found, firedEvents, timeline, startedAt, skipMs, chatMs]);

  // 计时：首次点开同事后每秒刷新显示；聊天中把这一秒记进 chatMs（游戏钟冻结，聊天不吃钟）
  const activeRef = useRef<PersonaId | null>(null);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => {
      setNowTs(Date.now());
      if (activeRef.current != null) setChatMs((c) => c + 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsedMs = startedAt != null ? Math.max(0, nowTs - startedAt) : 0;
  // 游戏钟只在"逛办公室"时走：聊天时长(chatMs)不折算成游戏时间
  const gameMs = startedAt != null ? Math.max(0, elapsedMs - chatMs) * GAME_SPEED + skipMs : 0;
  const { day, hod } = gameClock(gameMs);
  const shownElapsedMs = elapsedMs + skipMs / GAME_SPEED; // ⏩ 快进的钟点也算进你的用时（战绩公平）

  const talkedCount = Object.keys(histories).filter((id) => (histories[id] ?? []).some((m) => m.role === "user")).length;
  const keyFound = [...found].filter((id) => KEY_CLUE_IDS.includes(id)).length;
  // 提效 = 你挖出的★核心痛点 × 8%。顾问不做系统也不碰单——你交付的是"指对堵点"，效率跟着涨。
  const boost = keyFound * BOOST_PER_KEY;
  const total = ALL_CLUES.length;
  const ready = talkedCount >= 2 || found.size >= 3;
  const foundClues = ALL_CLUES
    .filter((c) => found.has(c.id))
    .map((c) => ({ id: c.id, label: c.label, ownerName: c.ownerName, key: c.key }));
  const exportState = {
    sessionId,
    generatedAt: new Date(),
    elapsedLabel: fmt(shownElapsedMs),
    day,
    clock: fmtClock(hod),
    foundCount: found.size,
    totalClues: total,
    boost,
    foundClues,
    timeline,
  };

  const appendTimeline = (entry: Omit<SessionTimelineEntry, "id" | "realTs" | "gameDay" | "gameTime">) => {
    setTimeline((items) => [
      ...items,
      {
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        realTs: Date.now(),
        gameDay: day,
        gameTime: fmtClock(hod),
        ...entry,
      },
    ]);
  };

  // 收工换日：21:00 自动跳到次日早 9 点，弹一条横幅（null 起始 → 刷新恢复存档时不误弹）
  const dayRef = useRef<number | null>(null);
  useEffect(() => {
    if (startedAt == null) { dayRef.current = null; return; }
    const prev = dayRef.current;
    dayRef.current = day;
    if (prev != null && day > prev) {
      setDayToast(day);
      appendTimeline({ type: "day_change", title: `第 ${day} 天早上，接着摸需求` });
      sfx("done");
      const id = setTimeout(() => setDayToast(null), 4200);
      return () => clearTimeout(id);
    }
  }, [day, startedAt]);

  // 作息音效提醒：12:00 午休铃 / 13:00 回工位 / 18:00 下班铃(业务员们回家了)
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

  const addClues = (ids: string[], npcId?: PersonaId) => {
    const fresh = ids.filter((i) => !found.has(i));
    const freshKeys = fresh.filter((i) => KEY_CLUE_IDS.includes(i)).length;
    if (fresh.length) sfx(freshKeys > 0 ? "clueKey" : "clue");
    if (fresh.length) {
      const labels = ALL_CLUES.filter((c) => fresh.includes(c.id)).map((c) => c.label);
      appendTimeline({
        type: "clue",
        npcId,
        npcName: npcId ? NPCS[npcId]?.name : undefined,
        clueIds: fresh,
        clueLabels: labels,
      });
    }
    // 彩蛋级提效反馈：挖到★时飘一条小提示，订单板悄悄变好——不进顶栏、不抢主流程
    if (freshKeys > 0) {
      setNpcToast(`⚡ 你指对了一处堵点 · 团队提效 +${freshKeys * BOOST_PER_KEY}%`);
      setTimeout(() => setNpcToast(null), 2600);
    }
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
      const eventId = "boss_offrecord";
      setPendingEvent(eventId);
      appendTimeline({ type: "npc_open", npcId: eventId, npcName: NPCS[eventId].name, title: "老板酒局开场" });
      if (!(histories[eventId] ?? []).length) {
        appendTimeline({ type: "message", npcId: eventId, npcName: NPCS[eventId].name, role: "assistant", content: NPCS[eventId].opening });
      }
    }
  }, [found, firedEvents]);

  // NPC 主动来找你（通用管道：往 TA 的聊天记录里注入一条"走过来"的开场白 + 自动打开聊天）。
  // 用例1：进展太慢 → 老板出来催准话（第1天15:00仍0★，或第2天起仍≤1★；每天最多一次）。
  useEffect(() => {
    if (startedAt == null) return;
    const pushKey = `bosspush-d${day}`;
    if (firedEvents.has(pushKey)) return;
    const slow = (day === 1 && hod >= 15 && keyFound === 0) || (day >= 2 && keyFound <= 1);
    if (!slow) return;
    if (active || pendingEvent || pendingShare || diagnose) return; // 不打断进行中的对话/弹窗
    setFiredEvents((s) => new Set(s).add(pushKey));
    setHistories((h) => ({ ...h, boss: [...(h.boss ?? []), { role: "assistant" as const, content: BOSS_PUSH_MSG }] }));
    appendTimeline({ type: "npc_open", npcId: "boss", npcName: NPCS.boss.name, title: "老板主动来找你" });
    appendTimeline({ type: "message", npcId: "boss", npcName: NPCS.boss.name, role: "assistant", content: BOSS_PUSH_MSG });
    setActive("boss");
    sfx("event");
  }, [hod, day, keyFound, startedAt, firedEvents, active, pendingEvent, pendingShare, diagnose]);

  const restart = () => {
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    setActive(null); setHistories({}); setFound(new Set()); setFiredEvents(new Set());
    setPendingEvent(null); setPendingShare(false); setManualShare(false); setExportOpen(false); setDiagnose(false);
    setStartedAt(null); setNowTs(Date.now()); setSkipMs(0); setChatMs(0); setDayToast(null); setNpcToast(null);
    const sid = newSessionId();
    setSessionId(sid);
    setTimeline(initialTimeline());
  };

  const selectNpc = (id: PersonaId) => {
    const t = Date.now();
    const firstVisit = !(histories[id] ?? []).length;
    setStartedAt((v) => v ?? t);
    setNowTs(t);
    // 下班守卫：人走了就聊不了（明早 9 点回来，或 ⏩ 快进）
    const offH = OFF_DUTY[id];
    if (startedAt != null && offH != null && hod >= offH) {
      sfx("close");
      setNpcToast(`🌙 ${NPCS[id].name.split("（")[0]}已经下班了 · 明早 9 点就回来`);
      setTimeout(() => setNpcToast(null), 2800);
      return;
    }
    sfx("open");
    appendTimeline({ type: "npc_open", npcId: id, npcName: NPCS[id].name, title: "开始对话" });
    if (firstVisit) {
      appendTimeline({ type: "message", npcId: id, npcName: NPCS[id].name, role: "assistant", content: NPCS[id].opening });
    }
    setActive(id);
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
          <span title="游戏内时间：9:00 上班 · 12-13 午休 · 18:00 起同事陆续下班 · 21:00 收工跳次日 · 聊天时时间暂停">
            {hod >= 19 ? "🌙" : hod >= 12 && hod < 13 ? "🍚" : "🕘"} 第{day}天 <b>{fmtClock(hod)}</b>
          </span>
          <button className="restart-btn" onClick={() => { sfx("ui"); setManualShare(true); }} title="把当前战绩分享到小红书">📤 分享</button>
          <button className="restart-btn" onClick={() => { sfx("ui"); setExportOpen(true); }} title="导出本局档案和完整对话">🗂 导出</button>
          <SoundToggle className="restart-btn" />
          <button className="restart-btn" onClick={restart} title="清空进度重新开始">↻ 重开</button>
          <button className="btn btn-accent diag-btn" disabled={!ready}
            onClick={() => { sfx("diagnose"); setDiagnose(true); }}
            title={ready ? "写下你判断的真痛点+建议，主管会对照真相点评打分" : "先多跟几个同事聊聊、集齐线索再下结论"}>
            📝 提交诊断
          </button>
        </div>
      </div>

      {/* 主体：左=办公室场地；右=常驻面板（聊天时是聊天区，不聊时是线索板） */}
      <div className="invest-body">
        <div className="stage">
          <Office onSelect={selectNpc} found={found} boost={boost} gameMs={gameMs} />
        </div>

        <aside className="side">
          {active ? (
            <Dialogue
              key={active}
              variant="panel"
              persona={NPCS[active]}
              sessionId={sessionId}
              seed={histories[active] ?? []}
              found={found}
              onPersist={(msgs) => setHistories((h) => ({ ...h, [active]: msgs }))}
              onClues={(ids) => addClues(ids, active)}
              onRecord={(event) => appendTimeline({ ...event, npcId: active, npcName: NPCS[active].name })}
              onClose={() => setActive(null)}
            />
          ) : (
            <div className={`note panel ${noteOpen ? "" : "folded"}`}>
              <button className="card-h note-head" onClick={() => setNoteOpen((v) => !v)}>
                🔍 线索笔记本　<span className="note-count">{found.size}/{total}</span>
                <span className="note-caret">{noteOpen ? "▾" : "▸"}</span>
              </button>
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
            </div>
          )}
        </aside>
      </div>

      <Link href="/" className="exit-link">← 退出</Link>
      <GitHubLink />

      {/* 换日/下班小横幅 */}
      {dayToast != null && (
        <div className="day-toast panel">🌙 昨晚收了工 · ☀️ 第 {dayToast} 天早上，接着摸</div>
      )}
      {npcToast != null && <div className="day-toast panel">{npcToast}</div>}

      {/* 分享弹窗：集满 3 条自动弹一次 + 顶栏「📤 分享」随时手动打开（数字都取当下战绩） */}
      {(pendingShare || manualShare) && !active && !pendingEvent && (
        <ShareModal foundCount={found.size} timeLabel={fmt(shownElapsedMs)} day={day} boost={boost} onClose={() => { setPendingShare(false); setManualShare(false); }} />
      )}
      {exportOpen && (
        <ExportModal state={exportState} onClose={() => setExportOpen(false)} />
      )}
      {/* 事件：老板酒局（全屏大排档场景，保留浮层仪式感）。等玩家聊完当前同事再开场 */}
      {pendingEvent && !active && (
        <Dialogue
          persona={NPCS[pendingEvent]}
          sessionId={sessionId}
          seed={histories[pendingEvent] ?? []}
          found={found}
          onPersist={(msgs) => setHistories((h) => ({ ...h, [pendingEvent]: msgs }))}
          onClues={() => { /* 酒局不进笔记本：信号在对话本身，已入库供回看 */ }}
          onRecord={(event) => appendTimeline({ ...event, npcId: pendingEvent, npcName: NPCS[pendingEvent].name })}
          onClose={() => setPendingEvent(null)}
          event={{
            backdropClass: "event-drinks",
            caption: "🍻 下班后 · 老地方大排档。李总多喝了两杯，话比白天多……（这段也会被记录）",
          }}
        />
      )}
      {diagnose && (
        <DiagnoseModal
          sessionId={sessionId}
          foundClues={[...found]}
          onSubmitted={(diagnosis) => appendTimeline({ type: "diagnosis_submitted", content: diagnosis })}
          onFeedback={(feedback) => appendTimeline({ type: "diagnosis_feedback", content: feedback })}
          onClose={() => setDiagnose(false)}
        />
      )}
    </div>
  );
}
