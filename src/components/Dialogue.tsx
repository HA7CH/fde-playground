"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Persona } from "@/lib/types";
import FontToggle from "./FontToggle";
import { sfx } from "@/lib/sfx";
import { shake } from "@/lib/fx";

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
  const windowRef = useRef<HTMLDivElement>(null);
  const portrait = `/assets/sprites2/char2_${persona.sprite ?? persona.id}.png`;
  // 这个人身上的线索是否已全部问出（只有带线索的关键同事才会触发，干扰角色/酒局 clues 为空 → 恒 false）
  const myClues = persona.clues ?? [];
  const exhausted = myClues.length > 0 && myClues.every((c) => found.has(c.id));
  const close = () => { sfx("close"); onClose(); };

  useEffect(() => {
    onPersist(messages);
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // 音效：酒局事件进场用更戏剧化的音（普通工位对话的「叮」在 play 页点击时已放）
  useEffect(() => { if (event) { sfx("event"); shake(windowRef.current, 9, 480); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 音效：这个人刚被问干净时，来一小段完成音（重开/复读已问完的人不重复放）
  const wasExhausted = useRef(exhausted);
  useEffect(() => {
    if (exhausted && !wasExhausted.current) sfx("done");
    wasExhausted.current = exhausted;
  }, [exhausted]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sfx("send");
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
      if (clean(acc).trim()) sfx("receive");
      const ids = extractClues(acc);
      if (ids.length) onClues(ids);
      // 拿到「新的」★ 核心痛点线索时才抖（排除已入袋的——服务端兜底会对重复内容再补标记，不能重复抖；与 play 页的声音去重逻辑一致）
      if (ids.some((id) => !found.has(id) && myClues.some((c) => c.id === id && c.key))) shake(windowRef.current, 6, 320);
      if (!clean(acc).trim()) setMessages([...outgoing, { role: "assistant", content: "（……没说话，再问一句试试）" }]);
    } catch {
      setMessages([...outgoing, { role: "assistant", content: "（网络打了个嗝，再说一句试试）" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`dlg-backdrop ${event?.backdropClass ?? ""}`} onClick={close}>
      <div className="dlg-window panel" ref={windowRef} onClick={(e) => e.stopPropagation()}>
        <div className="dlg-bar" style={{ background: persona.color }}>
          <div className="dlg-portrait"><img src={portrait} alt={persona.title} /></div>
          <div className="dlg-name"><b>{persona.name}</b><span>{persona.emoji} {persona.title} · WAYBOUND 货代</span></div>
          <FontToggle />
          <button className="dlg-close" onClick={close} aria-label="关闭">✕</button>
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
