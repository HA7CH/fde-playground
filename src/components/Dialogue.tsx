"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Persona } from "@/lib/types";
import FontToggle from "./FontToggle";

const CLUE_RE = /\s*\[\[CLUE:([^\]]+)\]\]/g;
const clean = (s: string) => s.replace(CLUE_RE, "");
const extractClues = (s: string) => [...s.matchAll(CLUE_RE)].map((m) => m[1].trim());

/** 事件的展示契约：backdrop 换肤 + 顶部旁白 + 可选场景条。
 *  scene 渲染在 dlg-bar 下方的定高槽位（框内、随文档流），勿做全屏定位。 */
export type DialogueEvent = { backdropClass: string; caption: string; scene?: React.ReactNode };

export default function Dialogue({
  persona,
  sessionId,
  seed,
  found,
  onPersist,
  onClues,
  onClose,
  event,
}: {
  persona: Persona;
  sessionId: string;
  seed: ChatMessage[];
  /** 已集齐的线索 id 集合，用来判断这个人是否已被问干净 */
  found: Set<string>;
  onPersist: (msgs: ChatMessage[]) => void;
  onClues: (ids: string[]) => void;
  onClose: () => void;
  /** 事件场景（不传则是普通工位对话） */
  event?: DialogueEvent;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    seed.length ? seed : [{ role: "assistant", content: persona.opening }],
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const portrait = `/assets/sprites2/char2_${persona.sprite ?? persona.id}.png`;
  // 这个人身上的线索是否已全部问出（只有带线索的关键同事才会触发，干扰角色/酒局 clues 为空 → 恒 false）
  const myClues = persona.clues ?? [];
  const exhausted = myClues.length > 0 && myClues.every((c) => found.has(c.id));

  useEffect(() => {
    onPersist(messages);
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const outgoing: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...outgoing, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, npcId: persona.id, messages: outgoing }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages([...outgoing, { role: "assistant", content: clean(acc) }]);
      }
      const ids = extractClues(acc);
      if (ids.length) onClues(ids);
      if (!clean(acc).trim()) setMessages([...outgoing, { role: "assistant", content: "（……没说话，再问一句试试）" }]);
    } catch {
      setMessages([...outgoing, { role: "assistant", content: "（网络打了个嗝，再说一句试试）" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`dlg-backdrop ${event?.backdropClass ?? ""}`} onClick={onClose}>
      <div className="dlg-window panel" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-bar" style={{ background: persona.color }}>
          <div className="dlg-portrait"><img src={portrait} alt={persona.title} /></div>
          <div className="dlg-name"><b>{persona.name}</b><span>{persona.emoji} {persona.title} · WAYBOUND 货代</span></div>
          <FontToggle />
          <button className="dlg-close" onClick={onClose} aria-label="关闭">✕</button>
        </div>

        {event?.scene /* 事件小场景：嵌在标题栏下、聊天记录上（框内，不铺全屏） */}

        <div className="dlg-log" ref={logRef}>
          {event && <div className="scene-cap">{event.caption}</div>}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "assistant" && <img className="msg-av" src={portrait} alt="" />}
              <div className={`bubble ${busy && m.role === "assistant" && i === messages.length - 1 && !m.content ? "typing" : ""}`}>
                {m.content || (busy && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
          ))}
        </div>

        {exhausted && (
          <div className="dlg-done">
            ✅ 这位{persona.title}该问的都问到了（{myClues.length} 条线索已入袋）· 回办公室换个人聊聊
          </div>
        )}

        <div className="dlg-foot">
          <input
            value={input}
            placeholder={`问问${persona.title}…`}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }}
            disabled={busy}
          />
          <button className="btn btn-accent" onClick={send} disabled={busy || !input.trim()}>发送</button>
        </div>
      </div>
    </div>
  );
}
