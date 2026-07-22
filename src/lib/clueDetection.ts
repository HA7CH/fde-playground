import type { Persona } from "./types";

const CLUE_RE = /\[\[CLUE:([^\]]+)\]\]/g;

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));
const hasAll = (text: string, words: string[]) => words.every((w) => text.includes(w));
const count = (text: string, words: string[]) => words.filter((w) => text.includes(w)).length;

/**
 * 服务端线索兜底：当 LLM 明明说出了某条线索事实、却漏打隐藏标记时，服务端补上。
 *
 * 判定分两层，**判别性信号只认 NPC 自己的回答**：
 * - npc(answer): 判别词，必须出现在 NPC 的**回答文本**里。绝不看玩家的提问——
 *   否则玩家把答案关键词写进问题就能“刷”线索（哪怕 NPC 否认），破坏测评信号。
 * - ctx(turn):   可选的宽泛话题词，允许出现在“玩家问题 + NPC 回答”整轮里，只兜上下文、不作判别。
 *
 * 关键词依据 lib/llm.ts 里各 NPC 的真实话术校准，确保 NPC 真说到时能命中、玩家单靠提问命不中。
 */
type Rule = {
  id: string;
  /** 判别信号：只在 NPC 回答里找 */
  npc: (answer: string) => boolean;
  /** 可选话题信号：可在整轮文本里找 */
  ctx?: (turn: string) => boolean;
};

const RULES: Record<string, Rule[]> = {
  boss: [
    // “我就要全自动的” —— 伪需求。老板在自己嘴里点名全自动/一键自动。
    { id: "boss-fakeneed", npc: (a) => a.includes("全自动") || (a.includes("自动") && has(a, ["一键", "一步到位", "都给我", "全给"])) },
    // 对单/做账赔钱、放单出过事故。
    { id: "boss-realpain", npc: (a) => (has(a, ["对单", "做账"]) && has(a, ["赔", "亏", "出岔子", "出错", "乱", "岔子", "投诉"])) || (a.includes("放单") && has(a, ["事故", "索赔", "赔", "放错", "放早"])) },
    // 老板张口报的人力成本（八千/一万/十来万），且落在“跟单/人力/一年一个月/省下这个”的语境。
    { id: "boss-wrongnum", npc: (a) => has(a, ["十来万", "八千", "一万", "人力成本"]) && has(a, ["跟单", "人力", "一年", "一个月", "省下这个", "省下"]) },
    // 组织层级：一次说全阿强+婷婷+小敏。
    { id: "boss-org", npc: (a) => hasAll(a, ["阿强", "婷婷", "小敏"]) },
    // 接单接不过来 —— 产能受限而非需求受限。用老板的原话锚定。
    { id: "boss-capacity", npc: (a) => has(a, ["接不过来", "不敢接", "忙不过来", "做不动", "接不了", "产能跟不上"]) },
    // 卡点四成内部/六成外部。
    { id: "boss-bottleneck", npc: (a) => (a.includes("四成") && a.includes("六成")) || (hasAll(a, ["内部", "外部"]) && has(a, ["对单", "做账", "船期", "卡点", "瓶颈"])) },
    // 毛利率仅 5-8%——薄利行业，防错比多接单更值钱（2026-07-15 persona 从"三成"修正为"5-8%"，同步更新检测关键词）。
    { id: "boss-margin", npc: (a) => has(a, ["毛利", "利润率"]) && has(a, ["5", "8", "薄利", "几个点", "五", "八", "低毛利"]) },
  ],
  manager: [
    // 一次列全 ≥5 段流程。
    { id: "mgr-flow", npc: (a) => count(a, ["订舱", "补料", "对单", "截单", "开船", "做账", "放单"]) >= 5 },
    // 船司官网要用公司账号登，账号由主管发。判别词=公司账号/账号发你；话题=船司/官网。
    { id: "mgr-access", npc: (a) => has(a, ["公司账号", "账号发你", "账号登", "开权限", "账号权限"]), ctx: (t) => has(t, ["船司", "官网", "网站", "登", "ONE", "马士基", "长荣", "ZIM"]) },
    // 主管自评“我自己每天也就用一小时” —— 价值低估。锚定“自己/剩下/异常/提效”的自述语境。
    { id: "mgr-undervalue", npc: (a) => has(a, ["一小时", "一个小时", "个把小时"]) && has(a, ["我自己", "我每天", "我也就", "剩下", "异常", "提多少效", "提效"]) },
  ],
  sales: [
    // 同一票货拆 USD/RMB 两张 DN。判别词=拆/两张 + 币种/账单。
    { id: "sales-dn", npc: (a) => has(a, ["拆", "两张", "两份"]) && has(a, ["USD", "RMB", "美金", "人民币", "账单"]) },
    // “发链接填托书”别家早有了。判别词=别家/同行早有；话题=链接/托书/平台。
    { id: "sales-exist", npc: (a) => has(a, ["别家", "同行", "别人早", "早有", "已经有", "已经在用", "市面上"]), ctx: (t) => has(t, ["链接", "托书", "填单", "平台", "填"]) },
  ],
  clerk: [
    // 对单开两个 tab 肉眼比 MBL/HBL/SI/补料。
    { id: "clerk-recon", npc: (a) => has(a, ["tab", "窗口", "肉眼", "来回切", "两个"]) && has(a, ["对单", "MBL", "HBL", "SI", "补料", "核对"]) },
    // 合法预期差异别误报：电放费/ICS2/报价≠签费。判别域词 + 预期/别标红/正常。
    { id: "clerk-expected", npc: (a) => has(a, ["预期", "差异", "别标红", "别全标红", "不是漏", "正常", "合法"]) && has(a, ["电放费", "ICS2", "报价", "签费", "非欧盟"]) },
    // 最怕截单；收款是放单硬前置。
    { id: "clerk-deadline", npc: (a) => (a.includes("截单") && has(a, ["怕", "最", "错过", "硬", "前置", "deadline", "收款", "放单"])) || (has(a, ["收款", "没收到钱", "钱没到账"]) && a.includes("放单")) },
    // 怕被系统取代。恐惧表达必须出现在跟单员自己的回答里。
    { id: "clerk-fear", npc: (a) => has(a, ["取代", "替代", "饭碗", "没用了", "下岗", "失业", "不用我们", "砸了"]) },
  ],
};

/** 抽出文本里已经打好的 [[CLUE:id]] 标记 id。 */
export function extractTaggedClueIds(text: string): string[] {
  return [...text.matchAll(CLUE_RE)].map((m) => m[1].trim());
}

/**
 * 推断本轮 NPC 已说到、但漏打标记的线索 id。
 * - 只在该角色自己的线索白名单内（persona.clues）匹配 —— 干扰角色/酒局无线索定义，直接返回空。
 * - 已经打过标记的不重复补。
 * - 判别词只看 assistantText；话题词看整轮 userText+assistantText。
 */
export function inferClueIds(persona: Persona, userText: string, assistantText: string): string[] {
  if (!persona.clues.length) return [];

  const allowed = new Set(persona.clues.map((c) => c.id));
  const tagged = new Set(extractTaggedClueIds(assistantText));
  const turn = `${userText}\n${assistantText}`;

  return (RULES[persona.id] ?? [])
    .filter((r) => allowed.has(r.id) && !tagged.has(r.id) && r.npc(assistantText) && (r.ctx ? r.ctx(turn) : true))
    .map((r) => r.id);
}
