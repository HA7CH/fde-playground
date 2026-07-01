"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Office from "@/components/Office";
import Dialogue from "@/components/Dialogue";
import DiagnoseModal from "@/components/DiagnoseModal";
import { ALL_CLUES, NPCS } from "@/lib/personas";
import type { ChatMessage, PersonaId } from "@/lib/types";

function newSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export default function Play() {
  const sessionId = useMemo(newSessionId, []);
  const [active, setActive] = useState<PersonaId | null>(null);
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});
  const [found, setFound] = useState<Set<string>>(new Set());
  const [diagnose, setDiagnose] = useState(false);
  // 事件：满 N 条线索触发"老板酒局"。pending = 已触发待开场；fired 保证一次性。
  const [firedEvents, setFiredEvents] = useState<Set<string>>(new Set());
  const [pendingEvent, setPendingEvent] = useState<PersonaId | null>(null);

  const talkedCount = Object.keys(histories).filter((id) => (histories[id] ?? []).some((m) => m.role === "user")).length;
  const total = ALL_CLUES.length;
  const ready = talkedCount >= 2 || found.size >= 3;

  const addClues = (ids: string[]) => setFound((s) => { const n = new Set(s); ids.forEach((i) => n.add(i)); return n; });

  // 集满 5 条线索 → 老板拉你喝酒（off-record）。只触发一次。（5=测试值，正式给候选人前可调回 8）
  useEffect(() => {
    if (found.size >= 5 && !firedEvents.has("drinks")) {
      setFiredEvents((s) => new Set(s).add("drinks"));
      setPendingEvent("boss_offrecord");
    }
  }, [found, firedEvents]);

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
        </div>
      </div>

      {/* 主体：办公室 + 线索笔记本 */}
      <div className="invest-body">
        <div className="stage">
          <Office onSelect={setActive} found={found} />
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
        <button className="btn btn-accent cta-btn" disabled={!ready} onClick={() => setDiagnose(true)}>
          📝 提交你的诊断
        </button>
      </div>

      <Link href="/" className="exit-link">← 退出</Link>

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
