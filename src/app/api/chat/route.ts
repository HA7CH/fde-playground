import { getPersona } from "@/lib/personas";
import { streamChat } from "@/lib/llm";
import { captureMessage } from "@/lib/store";
import type { ChatMessage, ChatRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLUE_TAG_RE = /\[\[CLUE:([^\]]+)\]\]/g;

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function fallbackClueTags(npcId: string, userText: string, assistantText: string) {
  const existing = new Set([...assistantText.matchAll(CLUE_TAG_RE)].map((m) => m[1]));
  const combined = `${userText}\n${assistantText}`.toLowerCase();
  const assistant = assistantText.toLowerCase();
  const inferred: string[] = [];

  const add = (id: string, ok: boolean) => {
    if (ok && !existing.has(id)) inferred.push(id);
  };

  if (npcId === "boss") {
    add("boss-wrongnum", hasAny(assistant, ["十来万", "八千", "一万"]) && hasAny(assistant, ["成本", "省"]));
    add("boss-org", hasAny(assistantText, ["阿强"]) && hasAny(assistantText, ["婷婷"]) && hasAny(assistantText, ["小敏"]));
  }

  if (npcId === "manager") {
    add("mgr-access", hasAny(assistant, ["公司账号", "账号发你"]) && hasAny(combined, ["船司", "one", "马士基", "长荣", "zim", "官网", "登录"]));
    add("mgr-undervalue", hasAny(assistant, ["一小时", "1小时", "一个小时"]) && hasAny(combined, ["异常", "一线", "婷婷", "跟单", "高频"]));
  }

  if (npcId === "sales") {
    add("sales-exist", hasAny(assistantText, ["别家平台", "小货代同行", "同行", "早有", "已经有"]) && hasAny(combined, ["链接", "托书", "填"]));
  }

  if (npcId === "clerk") {
    add("clerk-deadline", hasAny(assistantText, ["截单"]) && hasAny(assistantText, ["收款"]) && hasAny(assistantText, ["放单"]));
    add("clerk-fear", hasAny(assistantText, ["取代", "替代", "没用"]) && hasAny(combined, ["系统", "ai", "工具", "做出来"]));
  }

  return inferred.map((id) => `[[CLUE:${id}]]`).join("");
}

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
        const fallbackTags = fallbackClueTags(persona.id, lastUser?.content || "", full);
        if (fallbackTags) {
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
