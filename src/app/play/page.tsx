"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Office from "@/components/Office";
import Dialogue from "@/components/Dialogue";
import { PERSONAS } from "@/lib/personas";
import type { ChatMessage, PersonaId } from "@/lib/types";

function newSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export default function Play() {
  const sessionId = useMemo(newSessionId, []);
  const [active, setActive] = useState<PersonaId | null>(null);
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});

  return (
    <main className="play-root">
      <div className="play-bar">
        <Link href="/">← 退出</Link>
        <span>WAYBOUND 货代 · 需求群</span>
        <span style={{ opacity: 0.6 }}>session {sessionId.slice(0, 6)}</span>
      </div>

      <Office onSelect={setActive} />

      {active && (
        <Dialogue
          persona={PERSONAS[active]}
          sessionId={sessionId}
          seed={histories[active] ?? []}
          onPersist={(msgs) => setHistories((h) => ({ ...h, [active]: msgs }))}
          onClose={() => setActive(null)}
        />
      )}
    </main>
  );
}
