import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PersonaId, Role } from "./types";

// 采集层（SessionDossier）。把每一轮对话忠实落库。
// 没配 Supabase 时降级为服务端日志（no-op），绝不阻断对话——满足"开箱即跑"。
// 见 docs/v1-spec.md §3（采集 + 动态评分）。

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const storeConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (!storeConfigured) return null;
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export interface CapturedMessage {
  sessionId: string;
  npcId: PersonaId;
  role: Role;
  content: string;
}

export interface JudgeSample {
  sessionId: string;
  npcId: PersonaId;
  /** 线索裁判（AI）判的 id */
  judgeIds: string[];
  /** 关键词规则（经典）判的 id */
  ruleIds: string[];
}

/**
 * 双轨分歧样本（issue #16：先双轨跑，分歧样本落库复核）。
 * 只在裁判与规则判定不一致时调用；失败/未配置都不抛。
 * 期望表：judge_samples(session_id text, npc_id text, judge_ids jsonb, rule_ids jsonb, created_at timestamptz default now())
 */
export async function captureJudgeSample(s: JudgeSample): Promise<void> {
  const c = getClient();
  if (!c) {
    console.log(`[judge:diverge] ${s.sessionId} <${s.npcId}> judge=[${s.judgeIds}] rules=[${s.ruleIds}]`);
    return;
  }
  try {
    const { error } = await c.from("judge_samples").insert({
      session_id: s.sessionId,
      npc_id: s.npcId,
      judge_ids: s.judgeIds,
      rule_ids: s.ruleIds,
    });
    if (error) console.error("[judge:diverge] insert error", error.message);
  } catch (e) {
    console.error("[judge:diverge] threw", e);
  }
}

/**
 * 落一行对话。失败/未配置都不抛——采集不可靠不能拖垮对话。
 * 期望表：messages(session_id text, npc_id text, role text, content text, created_at timestamptz default now())
 */
export async function captureMessage(m: CapturedMessage): Promise<void> {
  const c = getClient();
  if (!c) {
    console.log(`[capture:noop] ${m.sessionId} <${m.npcId}> ${m.role}: ${m.content.slice(0, 80)}`);
    return;
  }
  try {
    const { error } = await c.from("messages").insert({
      session_id: m.sessionId,
      npc_id: m.npcId,
      role: m.role,
      content: m.content,
    });
    if (error) console.error("[capture] insert error", error.message);
  } catch (e) {
    console.error("[capture] threw", e);
  }
}
