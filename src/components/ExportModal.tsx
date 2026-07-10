"use client";

import { useMemo, useRef, useState } from "react";
import { buildPlainTextExport, buildXhsExport, type SessionExportState } from "@/lib/sessionExport";
import { sfx } from "@/lib/sfx";

export default function ExportModal({
  state,
  onClose,
}: {
  state: SessionExportState;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"xhs" | "plain">("xhs");
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const close = () => { sfx("close"); onClose(); };

  const texts = useMemo(() => ({
    xhs: buildXhsExport(state),
    plain: buildPlainTextExport(state),
  }), [state]);
  const text = texts[mode];

  const copy = async () => {
    sfx("ui");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      textRef.current?.select();
      setCopied(false);
    }
  };

  return (
    <div className="dlg-backdrop share-backdrop" onClick={close}>
      <div className="panel export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-head export-head">
          <span>🗂 本局档案导出</span>
          <button className="dlg-close" onClick={close} aria-label="关闭">✕</button>
        </div>
        <div className="export-body">
          <div className="export-tabs" role="tablist" aria-label="导出格式">
            <button className={mode === "xhs" ? "active" : ""} onClick={() => setMode("xhs")}>小红书版</button>
            <button className={mode === "plain" ? "active" : ""} onClick={() => setMode("plain")}>完整纯文本</button>
          </div>
          <div className="export-meta">
            第 <b>{state.day}</b> 天 {state.clock} · 线索 <b>{state.foundCount}/{state.totalClues}</b> · 已记录 <b>{state.timeline.length}</b> 条
          </div>
          <textarea
            ref={textRef}
            className="export-text"
            value={text}
            readOnly
            aria-label={mode === "xhs" ? "小红书分享文案" : "完整纯文本档案"}
          />
          <button className="btn btn-accent share-copy" onClick={copy}>
            {copied ? "✓ 已复制" : mode === "xhs" ? "📋 复制小红书文案" : "📋 复制完整档案"}
          </button>
          {mode === "xhs" && (
            <a className="share-open" href="https://www.xiaohongshu.com" target="_blank" rel="noreferrer">
              打开小红书 →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
