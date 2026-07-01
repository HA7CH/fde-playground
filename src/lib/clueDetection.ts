import type { Persona } from "./types";

const CLUE_RE = /\[\[CLUE:([^\]]+)\]\]/g;

type Rule = {
  id: string;
  test: (text: string) => boolean;
};

const has = (text: string, words: string[]) => words.some((word) => text.includes(word));
const hasAll = (text: string, words: string[]) => words.every((word) => text.includes(word));

const RULES: Record<string, Rule[]> = {
  boss: [
    {
      id: "boss-fakeneed",
      test: (text) =>
        text.includes("全自动") &&
        has(text, ["没那么简单", "先把", "真正", "不是", "伪需求", "别想着一步到位", "省人"]),
    },
    {
      id: "boss-realpain",
      test: (text) =>
        (text.includes("放单") && has(text, ["事故", "索赔", "赔", "放错", "放早"])) ||
        (hasAll(text, ["对单", "做账"]) && has(text, ["赔钱", "出岔子", "出错", "亏", "漏"])),
    },
    {
      id: "boss-wrongnum",
      test: (text) =>
        has(text, ["人力成本", "一个跟单", "跟单一个月", "一年十来万", "八千", "一万"]) &&
        has(text, ["算错", "虚高", "拍脑袋", "随口", "省人", "裁", "替代", "省下这个数"]),
    },
    {
      id: "boss-org",
      test: (text) => hasAll(text, ["阿强", "婷婷", "小敏"]) && has(text, ["管", "负责", "找", "问"]),
    },
    {
      id: "boss-capacity",
      test: (text) =>
        has(text, ["接不过来", "不敢接", "做不动", "产能跟不上", "产能", "忙不过来"]) &&
        has(text, ["单子", "客户", "需求", "多接"]),
    },
    {
      id: "boss-bottleneck",
      test: (text) =>
        (text.includes("四成") && text.includes("六成")) ||
        (hasAll(text, ["内部", "外部"]) && has(text, ["对单", "做账", "船期", "客户"])),
    },
    {
      id: "boss-margin",
      test: (text) => has(text, ["毛利", "利润"]) && has(text, ["三成", "30%", "百分之三十"]),
    },
  ],
  manager: [
    {
      id: "mgr-flow",
      test: (text) => ["订舱", "补料", "对单", "截单", "开船", "做账", "放单"].filter((word) => text.includes(word)).length >= 5,
    },
    {
      id: "mgr-access",
      test: (text) => has(text, ["船司官网", "船司网站"]) && has(text, ["公司账号", "账号权限", "开权限", "账号"]),
    },
    {
      id: "mgr-undervalue",
      test: (text) =>
        has(text, ["一小时", "个把小时", "用一个小时"]) &&
        has(text, ["一线", "婷婷", "跟单员", "手下"]) &&
        has(text, ["高频", "天天", "才有用", "真省时间", "真价值"]),
    },
  ],
  sales: [
    {
      id: "sales-dn",
      test: (text) =>
        has(text, ["DN", "账单", "费用"]) && has(text, ["USD", "RMB", "美金", "人民币", "两张", "拆"]),
    },
    {
      id: "sales-exist",
      test: (text) =>
        has(text, ["链接", "托书", "填单", "自己填"]) && has(text, ["别家", "平台", "同行", "早有", "已经在用"]),
    },
  ],
  clerk: [
    {
      id: "clerk-recon",
      test: (text) =>
        has(text, ["tab", "浏览器", "窗口", "肉眼", "来回切"]) &&
        has(text, ["MBL", "HBL", "SI", "补料", "对单"]),
    },
    {
      id: "clerk-expected",
      test: (text) =>
        has(text, ["合法", "预期差异", "误报", "标红", "正常"]) &&
        has(text, ["电放费", "ICS2", "报价", "签费", "非欧盟"]),
    },
    {
      id: "clerk-deadline",
      test: (text) => text.includes("截单") && has(text, ["收款", "钱没到账", "没收到钱", "放单"]),
    },
    {
      id: "clerk-fear",
      test: (text) => has(text, ["取代", "替代", "没用了", "饭碗", "失业", "不用我们", "砸了"]),
    },
  ],
};

export function extractTaggedClueIds(text: string): string[] {
  return [...text.matchAll(CLUE_RE)].map((match) => match[1].trim());
}

export function inferClueIds(persona: Persona, userText: string, assistantText: string): string[] {
  if (!persona.clues.length) return [];

  const allowed = new Set(persona.clues.map((clue) => clue.id));
  const tagged = new Set(extractTaggedClueIds(assistantText));
  const text = `${userText}\n${assistantText}`;

  return (RULES[persona.id] ?? [])
    .filter((rule) => allowed.has(rule.id) && !tagged.has(rule.id) && rule.test(text))
    .map((rule) => rule.id);
}
