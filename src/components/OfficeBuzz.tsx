"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// 打工人假通知（纯客户端 flavor，无 LLM、无采集）。
// 视角：外来驻场顾问，坐角落偷听某个同事冒一句牛马吐槽。
// 风格：短、毒、梗（小红书牛马口吻）。铁律：不写"人离开/工位空了"——画面里人没动。
type Buzz = { sprite: string; name: string; line: string };

// 随机播报：员工背地里吐槽"你这个顾问"来了（外来户视角，主打对"我的出现"的反应）
// 掺一点纯日常做底色，但主要都在议论你。
const AMBIENT: Buzz[] = [
  { sprite: "clerk", name: "婷婷", line: "又来个顾问，上次那个搞完系统更卡了。" },
  { sprite: "clerk", name: "婷婷", line: "别搭理他，问啥都说「不清楚」。" },
  { sprite: "clerk", name: "婷婷", line: "这人……不会是来取代我们的吧。" },
  { sprite: "clerk", name: "婷婷", line: "又得填表配合调研，活还不够多似的。" },
  { sprite: "sales", name: "小敏", line: "那个是新来的顾问？看着还挺靠谱哈。" },
  { sprite: "sales", name: "小敏", line: "上次咨询公司方案做得漂亮，然后就没然后了。" },
  { sprite: "sales", name: "小敏", line: "顾问来了，是不是又要开一堆会……" },
  { sprite: "manager", name: "阿强", line: "老板又花钱请人，这钱不如给我们发。" },
  { sprite: "manager", name: "阿强", line: "他懂货代吗？别外行指导内行。" },
  { sprite: "manager", name: "阿强", line: "配合下顾问……行，别耽误我核单就行。" },
  { sprite: "boss", name: "李总", line: "我请的顾问，你们都给我配合点！" },
  { sprite: "boss", name: "李总", line: "花了这钱，可得给我整出个名堂。" },
  // 纯日常做底色
  { sprite: "clerk", name: "婷婷", line: "俩 tab 对一下午单，眼都对花了。" },
  { sprite: "manager", name: "阿强", line: "又到月底了，做账做到怀疑人生。" },
];

// 聊完某人后触发：那个人转头议论"刚跟你聊完"这事
const AFTER_CHAT: Record<string, Buzz> = {
  boss: { sprite: "manager", name: "阿强", line: "老板跟那顾问聊挺久，怕是要动真格了。" },
  manager: { sprite: "manager", name: "阿强", line: "问这么细，他到底想搞啥。" },
  sales: { sprite: "sales", name: "小敏", line: "那顾问还挺好聊的，不像来抓人的～" },
  clerk: { sprite: "clerk", name: "婷婷", line: "问完就走，也不知道听懂没。" },
  boss_offrecord: { sprite: "boss", name: "李总", line: "这小子喝是能喝……就是嫩了点，能不能成，我还得掂量掂量。" },
};
const AFTER_CHAT_DEFAULT: Buzz = { sprite: "manager", name: "阿强", line: "又一个来问东问西的。" };

const pick = (avoid: string): Buzz => {
  const pool = AMBIENT.filter((x) => x.line !== avoid);
  return pool[Math.floor(Math.random() * pool.length)];
};

export type OfficeBuzzHandle = { afterChat: (id: string | null, talked: boolean) => void };

/** 办公室"打工人弹幕"。idle=没开任何弹框时才随机冒泡；afterChat 由父组件在聊完时调。 */
const OfficeBuzz = forwardRef<OfficeBuzzHandle, { idle: boolean }>(function OfficeBuzz({ idle }, ref) {
  const [buzz, setBuzz] = useState<Buzz | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);
  const last = useRef("");
  const idleRef = useRef(idle);
  idleRef.current = idle;

  const show = (b: Buzz) => {
    timers.current.forEach(window.clearTimeout);
    last.current = b.line;
    setLeaving(false);
    setBuzz(b);
    timers.current = [
      window.setTimeout(() => setLeaving(true), 4200), // 先渐隐
      window.setTimeout(() => setBuzz(null), 4700),    // 动画结束再卸载
    ];
  };

  // 随机播报：每 9s 一跳，空闲时约 45% 概率冒一条
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (!idleRef.current || Math.random() > 0.45) return;
      show(pick(last.current));
    }, 9000);
    return () => window.clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    afterChat(id, talked) {
      if (!id || !talked) return;
      const b = AFTER_CHAT[id] ?? AFTER_CHAT_DEFAULT;
      window.setTimeout(() => show(b), 380); // 等对话框关掉再冒
    },
  }));

  if (!buzz) return null;
  return (
    <div className={`buzz${leaving ? " buzz-out" : ""}`} key={buzz.line}>
      <img className="buzz-av" src={`/assets/sprites2/char2_${buzz.sprite}.png`} alt="" />
      <span className="buzz-line"><b>{buzz.name}</b>{buzz.line}</span>
    </div>
  );
});

export default OfficeBuzz;
