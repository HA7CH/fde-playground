"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Persona } from "@/lib/types";
import { PERSONAS, PERSONA_ORDER } from "@/lib/personas";
import FontToggle from "./FontToggle";
import { sfx } from "@/lib/sfx";
import { shake } from "@/lib/fx";

const CLUE_RE = /\s*\[\[CLUE:([^\]]+)\]\]/g;
const clean = (s: string) => s.replace(CLUE_RE, "");
const extractClues = (s: string) => [...s.matchAll(CLUE_RE)].map((m) => m[1].trim());

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
  /** 事件场景：换浮层背景 + 顶部旁白（不传则是普通工位对话） */
  event?: { backdropClass: string; caption: string };
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
  const nextHint = useMemo(() => {
    const remaining = PERSONA_ORDER
      .filter((id) => {
        const clues = PERSONAS[id]?.clues ?? [];
        return clues.length > 0 && clues.some((c) => !found.has(c.id));
      })
      .map((id) => PERSONAS[id].name.split("（")[0])
      .slice(0, 3);

    return remaining.length
      ? `再去跟${remaining.join("、")}聊聊`
      : "现在线索都收集全了！";
  }, [found]);
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
