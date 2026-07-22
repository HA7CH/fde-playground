export type TimelineEventType =
  | "session_start"
  | "npc_open"
  | "message"
  | "clue"
  | "diagnosis_submitted"
  | "diagnosis_feedback"
  | "day_change";

export interface SessionTimelineEntry {
  id: string;
  type: TimelineEventType;
  realTs: number;
  gameDay: number;
  gameTime: string;
  npcId?: string;
  npcName?: string;
  role?: "user" | "assistant";
  title?: string;
  content?: string;
  clueIds?: string[];
  clueLabels?: string[];
}

export interface ExportClue {
  id: string;
  label: string;
  ownerName: string;
  key?: boolean;
}

export interface SessionExportState {
  sessionId: string;
  generatedAt: Date;
  elapsedLabel: string;
  day: number;
  clock: string;
  foundCount: number;
  totalClues: number;
  boost: number;
  foundClues: ExportClue[];
  timeline: SessionTimelineEntry[];
}

function gameStamp(entry: Pick<SessionTimelineEntry, "gameDay" | "gameTime">) {
  return `第${entry.gameDay}天 ${entry.gameTime}`;
}

function formatRealTime(ts: number) {
  try {
    return new Date(ts).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return "";
  }
}

function cleanText(value?: string) {
  return String(value ?? "").replace(/\s*\[\[CLUE:[^\]]+\]\]/g, "").trim();
}

function timelineLine(entry: SessionTimelineEntry) {
  const stamp = `[${gameStamp(entry)}]`;
  const real = formatRealTime(entry.realTs);
  const suffix = real ? `（现实 ${real}）` : "";
  const npc = entry.npcName ? `${entry.npcName} ` : "";

  if (entry.type === "message") {
    const who = entry.role === "user" ? "玩家" : "NPC";
    return `${stamp} ${npc}${who}：${cleanText(entry.content)}${suffix}`;
  }

  if (entry.type === "clue") {
    const labels = entry.clueLabels?.length ? entry.clueLabels : entry.clueIds ?? [];
    return `${stamp} ${npc}解锁线索：${labels.join("；")}${suffix}`;
  }

  if (entry.type === "diagnosis_submitted") {
    return `${stamp} 提交诊断：${cleanText(entry.content)}${suffix}`;
  }

  if (entry.type === "diagnosis_feedback") {
    return `${stamp} 主管复盘：${cleanText(entry.content)}${suffix}`;
  }

  if (entry.type === "session_start") {
    return `${stamp} 开始本局${suffix}`;
  }

  if (entry.type === "day_change") {
    return `${stamp} ${entry.title ?? "进入新的一天"}${suffix}`;
  }

  return `${stamp} ${npc}${entry.title ?? "开始对话"}${suffix}`;
}

function clueLine(clue: ExportClue) {
  const mark = clue.key ? "★" : "✓";
  return `- ${mark} [${clue.ownerName}] ${clue.label}`;
}

function latestDiagnosis(timeline: SessionTimelineEntry[]) {
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    if (timeline[i].type === "diagnosis_submitted" && cleanText(timeline[i].content)) {
      return cleanText(timeline[i].content);
    }
  }
  return "";
}

export function buildPlainTextExport(state: SessionExportState) {
  const clueLines = state.foundClues.length
    ? state.foundClues.map(clueLine).join("\n")
    : "- 暂无，继续找同事聊聊";
  const timelineLines = state.timeline.length
    ? state.timeline.map((entry) => `- ${timelineLine(entry)}`).join("\n")
    : "- 暂无记录";

  return [
    "# FDE Playground 本局档案",
    "",
    `导出时间：${state.generatedAt.toLocaleString("zh-CN", { hour12: false })}`,
    `会话：${state.sessionId}`,
    `当前进度：第${state.day}天 ${state.clock}`,
    `游玩用时：${state.elapsedLabel}`,
    `线索：${state.foundCount}/${state.totalClues}`,
    `团队提效：+${state.boost}%`,
    "",
    "## 已解锁线索",
    clueLines,
    "",
    "## 游玩时间线",
    timelineLines,
  ].join("\n");
}

export function buildXhsExport(state: SessionExportState) {
  const keyClues = state.foundClues.filter((clue) => clue.key);
  const highlights = (keyClues.length ? keyClues : state.foundClues)
    .slice(0, 3)
    .map((clue) => `- ${clue.label}`)
    .join("\n");
  const diagnosis = latestDiagnosis(state.timeline);

  return [
    "我在玩「FDE Playground」：把一次真实货代驻场摸需求，压成一局像素办公室调研。",
    "",
    `这局用时 ${state.elapsedLabel}，公司里走到第 ${state.day} 天 ${state.clock}，摸出 ${state.foundCount}/${state.totalClues} 条线索${state.boost > 0 ? `，团队提效 +${state.boost}%` : ""}。`,
    highlights ? `我挖到的关键点：\n${highlights}` : "我还在摸线索，先把过程存档。",
    diagnosis ? `我的诊断：${diagnosis}` : "还没提交最终诊断，先分享当前进度。",
    "",
    "playground.ha7ch.com",
    "#FDE #货代 #AI应用 #像素游戏 #小红书游戏",
  ].join("\n");
}
