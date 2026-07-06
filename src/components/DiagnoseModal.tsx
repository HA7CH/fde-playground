"use client";

import { useRef, useState } from "react";
import FontToggle from "./FontToggle";
import { sfx } from "@/lib/sfx";
import { shake } from "@/lib/fx";

export default function DiagnoseModal({
  sessionId,
  foundClues,
  onClose,
}: {
  sessionId: string;
  foundClues: string[];
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const windowRef = useRef<HTMLDivElement>(null);
  const close = () => { sfx("close"); onClose(); };

  async function submit() {
    const diagnosis = text.trim();
    if (!diagnosis || busy) return;
    setBusy(true);
    setFeedback("");
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, diagnosis, foundClues }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setFeedback(acc);
      }
      if (acc.trim()) { sfx("done"); shake(windowRef.current, 6, 340); } // 主管点评出炉：完成音 + 抖一下
    } catch {
      setFeedback("（复盘时网络打了个嗝，再试一次）");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dlg-backdrop" onClick={close}>
      <div className="dlg-window panel" ref={windowRef} onClick={(e) => e.stopPropagation()}>
        <div className="dlg-bar" style={{ background: "#b4571c" }}>
          <div className="dlg-portrait"><img src="/assets/sprites2/char2_manager.png" alt="" /></div>
          <div className="dlg-name"><b>提交你的诊断</b><span>📋 主管阿强来听你汇报 · 对照真相点评</span></div>
          <FontToggle />
          <button className="dlg-close" onClick={close} aria-label="关闭">✕</button>
        </div>

        <div className="dlg-log">
          <p style={{ fontSize: 12, color: "var(--ink2)", margin: "0 0 4px", lineHeight: 1.7 }}>
            用一两句话写下：这家货代<b>最该先解决的真痛点</b>是什么、你建议<b>先做什么</b>。
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例：真痛点不在『全自动』，而在跟单员每天肉眼对单 + 做账最赔钱。建议先做一个轻量 AI 对单插件，而不是重做 ERP……"
            disabled={busy || !!feedback}
            style={{ width: "100%", minHeight: 88, fontFamily: "var(--pixel)", fontSize: 13, padding: 10, border: "2px solid var(--ink)", borderRadius: 8, background: "var(--paper)", resize: "vertical" }}
          />
          {feedback && (
            <div className="msg assistant" style={{ marginTop: 10 }}>
              <img className="msg-av" src="/assets/sprites2/char2_manager.png" alt="" />
              <div className="bubble">{feedback}</div>
            </div>
          )}
        </div>

        <div className="dlg-foot">
          {!feedback ? (
            <button className="btn btn-accent" style={{ flex: 1 }} onClick={submit} disabled={busy || !text.trim()}>
              {busy ? "主管在听…" : "📋 提交诊断，听主管点评"}
            </button>
          ) : (
            <button className="btn" style={{ flex: 1 }} onClick={close}>知道了</button>
          )}
        </div>
      </div>
    </div>
  );
}
