import { streamReview } from "@/lib/llm";
import { captureMessage } from "@/lib/store";
import { ALL_CLUES } from "@/lib/personas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const REVIEW_NPC_ID = "manager";

export async function POST(req: Request) {
  let body: { sessionId?: string; diagnosis?: string; foundClues?: string[] };
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  const sessionId = body.sessionId || "anon";
  const diagnosis = String(body.diagnosis ?? "").slice(0, 2000).trim();
  if (!diagnosis) return new Response("diagnosis required", { status: 400 });

  const found = (body.foundClues ?? [])
    .map((id) => ALL_CLUES.find((c) => c.id === id)?.label)
    .filter(Boolean);
  const foundText = found.length ? found.join("；") : "（几乎没挖到什么线索）";

  const userMsg =
    `这是我做完调研后的诊断：\n「${diagnosis}」\n\n我在调研里挖到的线索：${foundText}\n\n请你以主管阿强的口吻点评我摸得准不准。`;

  await captureMessage({ sessionId, npcId: REVIEW_NPC_ID, role: "user", content: `[诊断] ${diagnosis}` });

  const encoder = new TextEncoder();
  let full = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamReview([{ role: "user", content: userMsg }])) {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch (e) {
        console.error("[/api/diagnose]", e);
        controller.enqueue(encoder.encode("（复盘时网络打了个嗝，再试一次）"));
      } finally {
        controller.close();
        if (full.trim()) await captureMessage({ sessionId, npcId: REVIEW_NPC_ID, role: "assistant", content: `[复盘] ${full}` });
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
