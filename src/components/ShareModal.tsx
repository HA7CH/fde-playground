"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { shake } from "@/lib/fx";

const shareText = (n: number) =>
  `我在玩「FDE Playground」——一次真实货代驻场被压成 2 小时的像素解谜🕵️\n` +
  `在办公室里点同事、摸真需求，已经挖到 ${n} 条关键线索！你也来当一次 FDE 👇\n` +
  `playground.ha7ch.com\n` +
  `#FDE #独立游戏 #货代 #AI应用 #像素游戏`;

/** 集满 3 条线索时弹出：邀请玩家把这局体验发小红书（传播钩子）。一次性，由 play 页控制。 */
export default function ShareModal({ foundCount, onClose }: { foundCount: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = shareText(foundCount);
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
            你已经挖到 <b>{foundCount}</b> 条线索，有点 FDE 的样子了。
            把这局发个小红书，拉朋友也来摸一摸这家货代 👀
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
