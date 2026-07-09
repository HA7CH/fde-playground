"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Office from "@/components/Office";
import Dialogue from "@/components/Dialogue";
import DiagnoseModal from "@/components/DiagnoseModal";
import ShareModal from "@/components/ShareModal";
import SoundToggle from "@/components/SoundToggle";
import GitHubLink from "@/components/GitHubLink";
import LeaderboardPanel from "@/components/LeaderboardPanel";
import { ALL_CLUES, KEY_CLUE_IDS, NPCS, OFF_DUTY } from "@/lib/personas";
import type { ChatMessage, PersonaId } from "@/lib/types";
import {
  buildRestartSnapshot,
  elapsedForRun,
  gameClock,
  gameMsForRun,
  maybeCompleteRun,
  pickDisplayedTiming,
} from "@/lib/progress";
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

// 提效：每挖到一条★核心痛点，团队效率 +8%（你在真的帮这家公司提效——订单板跟着变好）
const BOOST_PER_KEY = 8;
// 进展太慢 → 老板主动出来催（第 1 天 15:00 还没挖到★，或次日以后仍原地踏步；每天最多一次）
const BOSS_PUSH_MSG = "（李总从里间踱出来，敲了敲你的桌边）小伙子，来了也有阵子了吧？我可听阿强说你就四处转了转……说说，摸出个所以然没有？别绕弯子，我就要句实在话：问题到底出在哪？";

function fmtClock(hod: number) {
  const h = Math.floor(hod), m = Math.floor((hod - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
  const [chatMs, setChatMs] = useState(0); // 聊天累计时长——聊天不吃游戏钟（开罗铁律），持久化
  const [completion, setCompletion] = useState<{
    completedAt: number;
    finalElapsedMs: number;
    finalGameMs: number;
    finalDay: number;
  } | null>(null);
  const [dayToast, setDayToast] = useState<number | null>(null); // 换日横幅
  const [npcToast, setNpcToast] = useState<string | null>(null); // "TA 下班了"之类的小提示
  const [noteOpen, setNoteOpen] = useState(true); // 线索板折叠（手机默认收起）

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
      if (typeof s?.chatMs === "number") setChatMs(s.chatMs);
      if (s?.completion && typeof s.completion.finalElapsedMs === "number") setCompletion(s.completion);
    } catch {
      setSessionId(newSessionId());
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
        sessionId, histories, found: [...found], firedEvents: [...firedEvents], startedAt, skipMs, chatMs, completion,
      }));
    } catch { /* 隐私模式/超额，忽略 */ }
  }, [hydrated, sessionId, histories, found, firedEvents, startedAt, skipMs, chatMs, completion]);

  // 计时：首次点开同事后每秒刷新显示；聊天中把这一秒记进 chatMs（游戏钟冻结，聊天不吃钟）
  const activeRef = useRef<PersonaId | null>(null);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => {
    if (startedAt == null || completion) return;
    const id = setInterval(() => {
      setNowTs(Date.now());
      if (activeRef.current != null) setChatMs((c) => c + 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, completion]);

  const elapsedMs = elapsedForRun({ nowTs, startedAt, skipMs });
  // 游戏钟只在"逛办公室"时走：聊天时长(chatMs)不折算成游戏时间
  const dynamicGameMs = gameMsForRun({ nowTs, startedAt, chatMs, skipMs });
  const shown = pickDisplayedTiming({ completion, elapsedMs, gameMs: dynamicGameMs });
  const gameMs = shown.gameMs;
  const { day, hod } = gameClock(gameMs);
  const shownElapsedMs = shown.elapsedMs; // ⏩ 快进的钟点也算进你的用时（战绩公平）

  const talkedCount = Object.keys(histories).filter((id) => (histories[id] ?? []).some((m) => m.role === "user")).length;
  const keyFound = [...found].filter((id) => KEY_CLUE_IDS.includes(id)).length;
  // 提效 = 你挖出的★核心痛点 × 8%。顾问不做系统也不碰单——你交付的是"指对堵点"，效率跟着涨。
  const boost = keyFound * BOOST_PER_KEY;
  const total = ALL_CLUES.length;
  const ready = talkedCount >= 2 || found.size >= 3;
  const complete = Boolean(completion);

  useEffect(() => {
    if (!hydrated || completion || found.size < total) return;
    const nextCompletion = maybeCompleteRun({
      completion,
      foundCount: found.size,
      total,
      nowTs: Date.now(),
      startedAt,
      chatMs,
      skipMs,
    });
    if (nextCompletion) setCompletion(nextCompletion);
  }, [hydrated, completion, found, total, startedAt, chatMs, skipMs]);

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

  const addClues = (ids: string[]) => {
    const fresh = ids.filter((i) => !found.has(i));
    const freshKeys = fresh.filter((i) => KEY_CLUE_IDS.includes(i)).length;
    if (fresh.length) sfx(freshKeys > 0 ? "clueKey" : "clue");
    // 彩蛋级提效反馈：挖到★时飘一条小提示，订单板悄悄变好——不进顶栏、不抢主流程
    if (freshKeys > 0) {
      setNpcToast(`⚡ 你指对了一处堵点 · 团队提效 +${freshKeys * BOOST_PER_KEY}%`);
      setTimeout(() => setNpcToast(null), 2600);
    }
    const nextFound = new Set(found);
    ids.forEach((i) => nextFound.add(i));
    const nextCompletion = maybeCompleteRun({
      completion,
      foundCount: nextFound.size,
      total,
      nowTs: Date.now(),
      startedAt,
      chatMs,
      skipMs,
    });
    if (nextCompletion && !completion) {
      setCompletion(nextCompletion);
      setNpcToast(`🏁 16/16 线索集齐 · 通关耗时 ${fmt(nextCompletion.finalElapsedMs)}`);
      setTimeout(() => setNpcToast(null), 3200);
      sfx("done");
    }
    setFound(nextFound);
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
    setActive("boss");
    sfx("event");
  }, [hod, day, keyFound, startedAt, firedEvents, active, pendingEvent, pendingShare, diagnose]);

  const restart = () => {
    const snapshot = buildRestartSnapshot({ currentRunKey: STORE_KEY });
    try { snapshot.removeKeys.forEach((key: string) => localStorage.removeItem(key)); } catch { /* ignore */ }
    window.location.reload();
  };

  const selectNpc = (id: PersonaId) => {
    const t = Date.now();
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
        <div className={`stage ${complete ? "stage-complete" : ""}`}>
          <Office onSelect={selectNpc} found={found} boost={boost} gameMs={gameMs} />
          {completion && (
            <LeaderboardPanel completion={completion} foundCount={found.size} total={total} />
          )}
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
              onClues={addClues}
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
        <ShareModal foundCount={found.size} timeLabel={fmt(shownElapsedMs)} day={completion?.finalDay ?? day} boost={boost} onClose={() => { setPendingShare(false); setManualShare(false); }} />
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
