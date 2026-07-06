import type { DialogueEvent } from "./Dialogue";
import SmokeScene from "./SmokeScene";

// off-record 事件登记表：触发条件 + 场景配置集中在这，play/page.tsx 只做唤起。
// 加新事件 = personas.ts 加人设（服务端 /api/chat 消费）+ 这里加一条（客户端触发/展示）。
export interface OffRecordEvent extends DialogueEvent {
  /** 事件人设 id（personas.ts NPCS 的键）。也用作一次性触发标记和对话历史的键。 */
  personaId: string;
  /** 触发条件（基于已获线索） */
  when: (found: Set<string>) => boolean;
}

export const OFFRECORD_EVENTS: OffRecordEvent[] = [
  {
    // 老板酒局：集满 5 条线索（5=测试值，正式给候选人前可调回 8）
    personaId: "boss_offrecord",
    when: (found) => found.size >= 5,
    backdropClass: "event-drinks",
    caption: "🍻 下班后 · 老地方大排档。李总多喝了两杯，话比白天多……（这段也会被记录）",
  },
  {
    // 婷婷烟摊：问出「怕被取代」那条线索 → 她拉你下楼抽烟（行为触发，非数量）
    personaId: "clerk_offrecord",
    when: (found) => found.has("clerk-fear"),
    backdropClass: "event-smoke",
    caption: "🚬 楼下消防通道 · 天黑了。婷婷觉得这里说话没人记……（这段也会被记录）",
    scene: <SmokeScene />,
  },
];
