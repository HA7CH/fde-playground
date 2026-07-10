import { getPersona } from "@/lib/personas";
import { streamChat } from "@/lib/llm";
import { captureMessage, captureJudgeSample } from "@/lib/store";
import { inferClueIds } from "@/lib/clueDetection";
import { judgeClues, judgeConfigured } from "@/lib/judge";
import type { ChatMessage, ChatRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let payload: ChatRequest;
  try {
    payload = (await req.json()) as ChatRequest;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const { sessionId, npcId, messages } = payload || ({} as ChatRequest);
  const persona = getPersona(npcId);
  if (!persona) return new Response("unknown npc", { status: 400 });
  if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });
  if (!sessionId) return new Response("sessionId required", { status: 400 });

  // 截断历史，留最近 ~20 轮
  const history: ChatMessage[] = messages.slice(-24).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content ?? "").slice(0, 4000),
  }));

  // 采集：最新一条用户消息（服务端落库，见 docs/v1-spec.md §3）
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (lastUser) {
    captureMessage({ sessionId, npcId: persona.id, role: "user", content: lastUser.content });
  }

  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamChat(persona, history)) {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        }
        // 兜底：NPC 明明说到某条线索却漏打隐藏标记时，服务端在流末尾补上（前端仍按原逻辑清理+入笔记本）。
        // AI native mode（灰度，见 lib/judge.ts）：兜底判定交给线索裁判，关键词规则退居降级路径；
        // 裁判不可用/超时/输出不合法 → 原样跑 inferClueIds，逐字节等于经典模式。
        const ruleInferred = inferClueIds(persona, lastUser?.content ?? "", full);
        let inferred = ruleInferred;
        if (judgeConfigured) {
          const judged = await judgeClues(persona, full);
          if (judged !== null) {
            inferred = judged;
            // 双轨复核：裁判与规则不一致的样本落库，供校准（两边都为空的不记）。
            const same = judged.length === ruleInferred.length && judged.every((id) => ruleInferred.includes(id));
            if (!same) {
              captureJudgeSample({ sessionId, npcId: persona.id, judgeIds: judged, ruleIds: ruleInferred });
            }
          }
        }
        if (inferred.length) {
          const fallbackTags = inferred.map((id) => `[[CLUE:${id}]]`).join(" ");
          full += fallbackTags;
          controller.enqueue(encoder.encode(fallbackTags));
        }
      } catch (e) {
        console.error("[/api/chat] stream error", e);
        controller.enqueue(encoder.encode("（网络打了个嗝，再说一句试试）"));
      } finally {
        controller.close();
        if (full.trim()) {
          captureMessage({ sessionId, npcId: persona.id, role: "assistant", content: full });
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
