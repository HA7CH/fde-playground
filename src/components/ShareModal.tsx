"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { shake } from "@/lib/fx";

const shareText = (n: number, t: string, b: number) =>
  `我在玩「FDE Playground」——一次真实货代驻场被压成 2 小时的像素解谜🕵️\n` +
  `我用时 ${t} 摸出 ${n} 条关键线索（光顾着聊，桌上积压了 ${b} 单😅）！你也来当一次 FDE，看看比我快不快 👇\n` +
  `playground.ha7ch.com\n` +
  `#FDE #独立游戏 #货代 #AI应用 #像素游戏`;

/** 集满 3 条线索时弹出：邀请玩家把这局体验发小红书（传播钩子）。一次性，由 play 页控制。 */
export default function ShareModal({ foundCount, timeLabel, backlog, onClose }: { foundCount: number; timeLabel: string; backlog: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = shareText(foundCount, timeLabel, backlog);
  const windowRef = useRef<HTMLDivElement>(null);
  const close = () => { sfx("close"); onClose(); };

  useEffect(() => { sfx("share"); shake(windowRef.current, 7, 380); }, []);

  const copy = async () => {
    sfx("ui");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="dlg-backdrop share-backdrop" onClick={close}>
      <div className="panel share-modal" ref={windowRef} onClick={(e) => e.stopPropagation()}>
        <div className="share-head">
          📕 摸到点门道了！
          <button className="dlg-close" onClick={close} aria-label="关闭">✕</button>
        </div>
        <div className="share-body">
          <p className="share-lead">
            你在 <b>{timeLabel}</b> 里挖到 <b>{foundCount}</b> 条线索（手边还积压着 <b>{backlog}</b> 单😅），有点 FDE 的样子了。
            把这局战绩发个小红书，拉朋友来比比谁更快 👀
          </p>
          <div className="share-text">{text}</div>
          <button className="btn btn-accent share-copy" onClick={copy}>
            {copied ? "✓ 已复制，去小红书粘贴" : "📋 复制文案"}
          </button>
          <a className="share-open" href="https://www.xiaohongshu.com" target="_blank" rel="noreferrer">
            打开小红书 →
          </a>
        </div>
        <div className="share-foot">
          <button className="btn share-later" onClick={close}>稍后再说，继续摸需求</button>
        </div>
      </div>
    </div>
  );
}
