"use client";

import Link from "next/link";
import Office from "@/components/Office";
import SoundToggle from "@/components/SoundToggle";
import GitHubLink from "@/components/GitHubLink";
import { PERSONA_ORDER, PERSONAS } from "@/lib/personas";
import { sfx } from "@/lib/sfx";

export default function Home() {
  return (
    <main className="title-screen">
      {/* 活的像素办公室背景（非交互）+ 压暗 + CRT 扫描线 */}
      <div className="title-bg" aria-hidden="true">
        <Office interactive={false} />
        <div className="title-scrim" />
        <div className="title-scan" />
      </div>

      <SoundToggle className="title-sound" />
      <GitHubLink />

      <div className="title-card panel title-enter">
        <span className="title-kicker">HATCH · FDE Playground</span>
        <h1 className="title-logo">
          FDE Playground
          <small>货代驻场 · 你来当那个 FDE，摸清这家公司的真痛点</small>
        </h1>
        <p className="title-sub">
          一家叫 WAYBOUND 的货代公司一团乱，老板请你来「捋一捋」。
          走进办公室，跟 4 个各有心思的同事打交道，从相互矛盾的信息里摸出真痛点。
        </p>

        <div className="title-cast">
          {PERSONA_ORDER.map((id) => (
            <div className="c" key={id}>
              <div className="pic" style={{ background: PERSONAS[id].color }}>
                <img src={`/assets/sprites2/char2_${id}.png`} alt={PERSONAS[id].title} />
              </div>
              <span>{PERSONAS[id].title}</span>
            </div>
          ))}
        </div>

        <div className="title-steps">
          <div className="h">🎮 怎么玩</div>
          <ol>
            <li><b>点办公室里的同事</b>聊天（老板/主管/业务员/跟单员），每人只知道自己那摊事。</li>
            <li>问对问题，关键信息会自动记进右边的<b>线索笔记本</b>（★ 是核心痛点）。</li>
            <li>线索攒够，点 <b>提交诊断</b>：写下你判断的真痛点+先做什么，<b>主管会对照真相点评打分</b>。</li>
          </ol>
        </div>

        <Link href="/play" className="btn btn-accent title-start" onClick={() => sfx("open")}>
          ▶ 进办公室
        </Link>
        <p className="title-foot">每个人只知道自己那摊事，没人知道全部真相 · 问对人，问对问题</p>
      </div>
    </main>
  );
}
