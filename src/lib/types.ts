/** 角色 id（key 人设固定；干扰角色为动态 id 如 c1/s1…） */
export type PersonaId = string;
export type SpriteKey = string;

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface Clue {
  /** 唯一 id（LLM 隐藏标记用） */
  id: string;
  /** 笔记本里显示的线索摘要 */
  label: string;
  /** 是否核心痛点线索（影响诊断评分权重） */
  key?: boolean;
  /** 给线索裁判（lib/judge.ts）的判定标准：NPC 在回答里亲口说出什么才算命中 */
  criteria?: string;
}

export interface Persona {
  id: PersonaId;
  /** 工位显示名（带角色） */
  name: string;
  /** 角色短标签 */
  title: string;
  /** 头顶 emoji（idle 状态气泡） */
  emoji: string;
  /** 像素小人主色（衣服） */
  color: string;
  /** 开场白（玩家首次靠近/点击时，不走 LLM） */
  opening: string;
  /** 喂给 LLM 的 system prompt（人设 + 隐藏知识 + 性格摩擦 + 主动抛的考题） */
  system: string;
  /** 这个角色能透露的关键线索（聊到时 LLM 埋标记，前端收进笔记本） */
  clues: Clue[];
  /** 绘制用精灵底模（默认 = id） */
  sprite?: SpriteKey;
}

export interface ChatRequest {
  sessionId: string;
  npcId: PersonaId;
  messages: ChatMessage[];
}
