import type { Clue, Persona } from "./types";
import { extractTaggedClueIds } from "./clueDetection";

// 线索裁判（issue #16 第一期第 1 项）：演员/裁判分离。
// 演员（streamChat）继续演人、埋 [[CLUE:id]] 标记；裁判在流尾用一次非流式、
// temperature 0 的 json_object 调用，判「这轮 NPC 的回答里到底说没说到哪条线索」，
// 取代关键词正则成为兜底判定 —— 玩家怎么问都被听懂，而不是撞判别词。
//
// 「LLM 提议、服务端裁决」三闸（验不过即丢，幻觉在结构上进不了笔记本）：
//   闸一：id 必须在该角色的线索白名单（persona.clues）内；
//   闸二：每条判定必须附 evidence，且 evidence 是 NPC 回答的逐字连续子串、≥8 字；
//   闸三：只认 NPC 回答不认玩家提问 —— 结构性保证：裁判的输入里根本没有玩家文本，
//         evidence 也只对 NPC 回答做子串校验。往提问里塞答案词无效。
//
// 降级路径 = 现状：AI_NATIVE_MODE 未开 / 无 key / 8s 超时 / JSON 不合法 → 返回 null，
// 调用方（api/chat）原样跑 inferClueIds，行为逐字节等于经典模式。

const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const TIMEOUT_MS = 8000;

/** AI native mode 灰度开关（issue #16 落地策略）：默认关 = 经典模式，判定走关键词规则。 */
export const aiNativeMode = process.env.AI_NATIVE_MODE === "1";

/** 裁判可用 = 开关开 且 配了 key。mock（无 key）下裁判没有意义，直接降级。 */
export const judgeConfigured = aiNativeMode && Boolean(API_KEY);

interface JudgeVerdict {
  id?: unknown;
  evidence?: unknown;
}

/**
 * 三闸校验（纯函数，不碰网络）：吃裁判的原始 JSON 输出，吐可入笔记本的线索 id。
 * 已打过 [[CLUE:id]] 标记的不重复补，语义与 inferClueIds 一致。
 */
export function validateJudgeVerdicts(raw: unknown, persona: Persona, assistantText: string): string[] {
  const verdicts = (raw as { clues?: JudgeVerdict[] })?.clues;
  if (!Array.isArray(verdicts)) return [];

  const allowed = new Set(persona.clues.map((c) => c.id));
  const tagged = new Set(extractTaggedClueIds(assistantText));
  const out: string[] = [];

  for (const v of verdicts) {
    const id = typeof v?.id === "string" ? v.id.trim() : "";
    const evidence = typeof v?.evidence === "string" ? v.evidence.trim() : "";
    if (!allowed.has(id) || tagged.has(id) || out.includes(id)) continue; // 闸一：白名单 + 不重复
    if (evidence.length < 8) continue;                                    // 闸二：evidence ≥8 字
    if (!assistantText.includes(evidence)) continue;                      // 闸二：逐字子串，只对 NPC 回答验
    out.push(id);
  }
  return out;
}

function judgePrompt(persona: Persona): string {
  const list = persona.clues
    .map((c: Clue) => `- ${c.id}: ${c.criteria || c.label}`)
    .join("\n");
  return `你是一个严格的判卷器。给你一段游戏 NPC「${persona.name}」本轮的回答文本，判断其中 NPC 是否亲口说出了下列线索的事实。

线索清单（id 只能从这里选）：
${list}

规则：
1. 只依据这段「NPC 回答文本」判断，文本之外的任何信息（包括你对玩家问了什么的推测）一律不算。
2. NPC 必须自己明确说出该事实才算——被否认、含糊带过、只是被问到都不算。
3. 每条命中必须附 evidence：从回答文本里逐字摘录的连续原文片段（至少 8 个字），能直接证明该事实；摘不出就不要报这条。
4. 没有命中就输出空数组。

只输出 JSON，形如：{"clues":[{"id":"...","evidence":"..."}]}`;
}

/**
 * 裁判入口：判本轮 NPC 回答命中了哪些线索。
 * 返回 null = 裁判不可用/失败（未开开关、无 key、超时、上游错误、JSON 不合法），
 * 调用方应降级 inferClueIds；返回 [] = 裁判明确判了「这轮什么都没说到」。
 */
export async function judgeClues(persona: Persona, assistantText: string): Promise<string[] | null> {
  if (!judgeConfigured || !persona.clues.length || !assistantText.trim()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: judgePrompt(persona) },
          { role: "user", content: `【NPC 回答文本】\n${assistantText.slice(0, 4000)}` },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[judge] upstream", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const content = (await res.json())?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return validateJudgeVerdicts(JSON.parse(content), persona, assistantText);
  } catch (e) {
    console.error("[judge] failed, fallback to rules", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
