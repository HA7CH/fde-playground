"use client";

import { SPRITE_FILES } from "./office-draw";

// 抽烟事件的"框内小场景"：嵌在对话框顶部（dlg-bar 下方）的一条像素立体图——
// 楼道吸烟角：夜窗、上行楼梯+扶手、安全出口/吸烟区牌、烟灰桶，
// 以及婷婷本人站在场景里抽烟：烟头火星一亮一暗（吸），烟圈一口一口往上飘（吐）。
// 纯 DOM/CSS，不碰 canvas 渲染层。
export default function SmokeScene() {
  return (
    <div className="smk" aria-hidden>
      <div className="smk-win"><i /></div>
      <div className="smk-exit">安全出口</div>
      <div className="smk-stairs" />
      <div className="smk-rail" />
      <div className="smk-sign">🚬 吸烟区</div>
      {/* 婷婷：双帧轮播（同办公室 canvas 的 idle 两帧）；烟跟着手走：垂着→举到嘴边（火星亮）→放下→吐烟圈 */}
      <div className="smk-ting">
        <img className="smk-f0" src={SPRITE_FILES.clerk_0} alt="" />
        <img className="smk-f1" src={SPRITE_FILES.clerk_1} alt="" />
        <span className="smk-cig" />
        <span className="smk-puff" />
        <span className="smk-puff p2" />
        <span className="smk-puff p3" />
      </div>
      <div className="smk-bin" />
      <div className="smk-floor" />
    </div>
  );
}
