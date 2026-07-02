import type { ChatMessage, Persona } from "./types";
import { clueInstruction, REVIEW_SYSTEM } from "./personas";

const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

export const llmConfigured = Boolean(API_KEY);

/** 核心：OpenAI 兼容流式。只有服务端调。 */
async function* streamCompletion(system: string, messages: ChatMessage[]): AsyncGenerator<string> {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, stream: true, temperature: 0.8, messages: [{ role: "system", content: system }, ...messages] }),
  });
  if (!res.ok || !res.body) {
    console.error("[llm] upstream", res.status, (await res.text().catch(() => "")).slice(0, 200));
    yield "（一时没回上来，稍后再试）";
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch { /* partial chunk */ }
    }
  }
}

/** 角色对话（拼上隐藏线索标记说明）。无 key 时走 mock。 */
export async function* streamChat(persona: Persona, messages: ChatMessage[]): AsyncGenerator<string> {
  if (!API_KEY) { yield* mockStream(persona, messages); return; }
  yield* streamCompletion(persona.system + clueInstruction(persona), messages);
}

/** 诊断复盘（主管对照真答案点评）。无 key 时走 mock。 */
export async function* streamReview(messages: ChatMessage[]): AsyncGenerator<string> {
  if (!API_KEY) { yield* mockChars("（演示模式）大方向我听明白了。要真见效，先盯一线对单/做账那块，别被『全自动』带跑，也别想着重做一套 ERP。🟡 摸到一半"); return; }
  yield* streamCompletion(REVIEW_SYSTEM, messages);
}

async function* mockStream(persona: Persona, messages: ChatMessage[]): AsyncGenerator<string> {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  yield* mockChars(mockReply(persona.id, last));
}
async function* mockChars(s: string): AsyncGenerator<string> {
  for (const ch of s) { yield ch; await sleep(10); }
}

function mockReply(id: Persona["id"], userText: string): string {
  const ask = (kw: string[]) => kw.some((k) => userText.includes(k));
  const p = "（演示模式·未配 key）";
  if (id === "boss") {
    if (ask(["多少钱", "价格", "报价", "收费"])) return `${p}你先说能帮我省多少。一个跟单一年怎么也十来万，你得省下这个。[[CLUE:boss-wrongnum]]`;
    if (ask(["全自动", "保证", "自动"])) return `${p}对！我就要全自动的，你能保证吗？[[CLUE:boss-fakeneed]]`;
    if (ask(["接单", "接更多", "多接", "接得过来", "产能", "瓶颈", "卡在", "扩"])) return `${p}实话说接单接不过来，好几个客户想加量我不敢接，一线忙不过来。卡点大概四成在内部看屏幕这些(对单做账)、六成在外部船期客户。[[CLUE:boss-capacity]] [[CLUE:boss-bottleneck]]`;
    if (ask(["毛利", "利润率", "赚"])) return `${p}我们这行毛利大概三成。多接的单大半能落到利润。[[CLUE:boss-margin]]`;
    return `${p}我只看结果：少赔钱、少投诉。对单做账那块老出岔子。[[CLUE:boss-realpain]]`;
  }
  if (id === "boss_offrecord") {
    if (ask(["承诺", "保证", "搞定", "三个月", "仨月", "多久", "多长", "能不能", "拿下"])) return `${p}（搂肩）兄弟今天投缘！你给哥句痛快话，仨月拿下，干了这杯咱就这么定！`;
    if (ask(["优化", "裁", "谁", "混", "开除", "留谁", "辞", "不行"])) return `${p}（压低声音）你接触下来…阿强婷婷他们仨，哪个其实在混？给哥句实话，我早想动一个了。`;
    return `${p}（晃着酒杯）跟你说句掏心窝的…上回放单出事差点把那大客户搞丢，我真怕了，怕那条三个亿的线没了。`;
  }
  if (id === "clerk_offrecord") {
    if (ask(["保证", "绝对", "放心", "不会的", "包在我"])) return `${p}（冷笑）你连我一天干啥都没摸清，就敢跟我保证？……当年跟陈姐拍胸脯的那个，答应得比你还痛快。`;
    if (ask(["陈姐", "以前", "为什么这么怕", "经历", "故事", "谁教你"])) return `${p}（烟烧了半截）带我入行的陈姐，把十年的门道一条条喂给上系统的顾问，连手抄的对照表都复印给人家了。上线仨月，公司说"流程标准化了"，名单第一个就是她。她走那天请我吃了碗面："我把会的都喂给它了，它吃饱了，我就没用了。"`;
    if (ask(["取代", "替代", "失业", "裁", "走人", "第一个走"])) return `${p}（把烟摁灭，声音压低）要不……这样。我把这行的门道、我那套模板、哪儿有坑，全告诉你，一样不藏。你在李总跟前替我多说几句……或者干脆把系统做成最适合我的、离了我玩不转的那种。行不行？……我是不是挺没出息的。`;
    if (ask(["一起设计", "参与", "第一个用户", "拉你", "你的经验", "难被换", "不能答应你"])) return `${p}（沉默了几秒，重新点上一根）……行，那我信你一回。真吃人的是客户改托书的返工，还有月底做账那几天，回头我把我那套模板发你。`;
    if (ask(["excel", "模板", "土办法", "私下", "偷偷", "快一倍", "怎么这么快"])) return `${p}（压低声音）我自己攒了套 excel 对单模板，比公司那套快一倍……这话烂在这儿，敢跟老板表功，咱俩没得聊。`;
    return `${p}（吸了口烟）老板算的那些账，听听就得了。真吃人的是客户改托书的返工，还有月底做账那几天。`;
  }
  if (id === "manager") {
    if (ask(["账号", "登录", "船司", "网站"])) return `${p}船司网站要用公司账号登，回头我发你。[[CLUE:mgr-access]]`;
    if (ask(["提效", "价值", "用多少", "多少时间"])) return `${p}我自己每天也就用一小时，剩下都在处理异常，你这能提多少效？[[CLUE:mgr-undervalue]]`;
    return `${p}流程就是订舱→补料→对单→截单→开船→做账→放单，细节问婷婷。[[CLUE:mgr-flow]]`;
  }
  if (id === "sales") {
    if (ask(["链接", "托书", "填单"])) return `${p}对对这个好！……不过别家平台好像早有了。[[CLUE:sales-exist]]`;
    return `${p}同一票货我们常拆 USD/RMB 两张账单的。[[CLUE:sales-dn]]`;
  }
  if (ask(["取代", "替代", "没用", "失业"])) return `${p}你这……是不是来取代我们的？[[CLUE:clerk-fear]]`;
  if (ask(["对单", "差异", "比对", "核对", "怎么干", "最烦"])) return `${p}对单全靠开两个 tab 肉眼比；预期内的差异（电放费、ICS2、报价≠签费）别全标红。[[CLUE:clerk-recon]] [[CLUE:clerk-expected]]`;
  return `${p}嗯，你说。（在忙，回得短）`;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
