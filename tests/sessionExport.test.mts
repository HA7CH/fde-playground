import assert from "node:assert/strict";
import test from "node:test";
import { buildPlainTextExport, buildXhsExport } from "../src/lib/sessionExport.ts";

const baseState = {
  sessionId: "session-1",
  generatedAt: new Date("2026-07-10T01:30:00.000Z"),
  elapsedLabel: "8:20",
  day: 1,
  clock: "09:15",
  foundCount: 1,
  totalClues: 12,
  boost: 8,
  foundClues: [
    {
      id: "boss-realpain",
      label: "老板真痛：对单/做账在赔钱、放单出过事故",
      ownerName: "老板",
      key: true,
    },
  ],
  timeline: [
    {
      id: "t1",
      type: "npc_open",
      realTs: Date.parse("2026-07-10T01:00:00.000Z"),
      gameDay: 1,
      gameTime: "09:00",
      npcId: "boss",
      npcName: "李总（老板）",
      title: "开始对话",
    },
    {
      id: "t2",
      type: "message",
      realTs: Date.parse("2026-07-10T01:01:00.000Z"),
      gameDay: 1,
      gameTime: "09:01",
      npcId: "boss",
      npcName: "李总（老板）",
      role: "user",
      content: "你最担心哪块赔钱？",
    },
    {
      id: "t3",
      type: "message",
      realTs: Date.parse("2026-07-10T01:01:12.000Z"),
      gameDay: 1,
      gameTime: "09:01",
      npcId: "boss",
      npcName: "李总（老板）",
      role: "assistant",
      content: "对单和做账这两块最让我头疼。",
    },
    {
      id: "t4",
      type: "clue",
      realTs: Date.parse("2026-07-10T01:01:13.000Z"),
      gameDay: 1,
      gameTime: "09:01",
      npcId: "boss",
      npcName: "李总（老板）",
      clueIds: ["boss-realpain"],
      clueLabels: ["老板真痛：对单/做账在赔钱、放单出过事故"],
    },
    {
      id: "t5",
      type: "diagnosis_submitted",
      realTs: Date.parse("2026-07-10T01:20:00.000Z"),
      gameDay: 1,
      gameTime: "09:12",
      content: "先做对单/做账切片。",
    },
    {
      id: "t6",
      type: "diagnosis_feedback",
      realTs: Date.parse("2026-07-10T01:20:20.000Z"),
      gameDay: 1,
      gameTime: "09:12",
      content: "摸得挺准。",
    },
  ],
};

test("buildPlainTextExport includes progress, timestamped NPC dialogue, clues, and diagnosis", () => {
  const text = buildPlainTextExport(baseState);

  assert.match(text, /FDE Playground 本局档案/);
  assert.match(text, /会话：session-1/);
  assert.match(text, /当前进度：第1天 09:15/);
  assert.match(text, /线索：1\/12/);
  assert.match(text, /团队提效：\+8%/);
  assert.match(text, /老板真痛：对单\/做账在赔钱、放单出过事故/);
  assert.match(text, /\[第1天 09:01\] 李总（老板） 玩家：你最担心哪块赔钱？/);
  assert.match(text, /\[第1天 09:01\] 李总（老板） NPC：对单和做账这两块最让我头疼。/);
  assert.match(text, /\[第1天 09:12\] 提交诊断：先做对单\/做账切片。/);
  assert.match(text, /\[第1天 09:12\] 主管复盘：摸得挺准。/);
});

test("buildXhsExport produces a compact share text with highlights", () => {
  const text = buildXhsExport(baseState);

  assert.match(text, /我在玩「FDE Playground」/);
  assert.match(text, /用时 8:20/);
  assert.match(text, /摸出 1\/12 条线索/);
  assert.match(text, /提效 \+8%/);
  assert.match(text, /老板真痛：对单\/做账在赔钱、放单出过事故/);
  assert.match(text, /#FDE/);
  assert.ok(text.length < 700);
});
