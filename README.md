# HATCH FDE 货代实战擂台 — 摸需求像素办公室

把一次真实的货代驻场 FDE 项目，压成一场可玩的实战：玩家进入一间像素办公室，点击 4 个同事（老板/主管/业务员/跟单员）跟他们对话，从信息不对称里摸清这家货代到底卡在哪——为后续"搭一个能跑的切片"做需求采集。

这是 **Phase 1（摸需求）前门**。（完整玩法/评分/架构等内部设计文档不随本仓库公开。）

## 技术栈
- **Next.js 15（App Router）+ React 19 + TypeScript**
- **DeepSeek**（OpenAI 兼容，流式）驱动 4 个 NPC 人设
- **Supabase**（Postgres）采集对话（SessionDossier）
- **Canvas 自渲染**像素办公室（引擎只渲染+上报点击；对话/LLM/采集全在 React + 后端）
- 中文像素字体 **Fusion Pixel**（SIL OFL）

## 架构边界（命门）
渲染层（`components/Office.tsx` + `office-draw.ts`）**只画场景 + 上报点击**，绝不碰 LLM/采集。点击 NPC → React 打开 `Dialogue` → `POST /api/chat` 流式调 DeepSeek → 每轮对话服务端落库 Supabase。换皮（Pixi/2.5D）不影响对话与采集。

## 线索识别稳定性
NPC 回答里的线索笔记本原本依赖 LLM 在回复末尾自觉追加隐藏标记（例如 `[[CLUE:boss-margin]]`）。真实流式模型会偶发“事实已经说出但忘记打标”的问题，导致玩家正常访谈却不涨线索数。

现在 `/api/chat` 在保留原有隐藏标记协议的同时，用 `lib/clueDetection.ts` 做一次确定性兜底：当某角色本轮**在自己的回答里**已明确说到该角色的某条线索事实、但模型漏写 `[[CLUE:id]]` 时，服务端在流末尾补上标记。**判别关键词只匹配 NPC 的回答文本，不看玩家提问**——避免玩家把答案写进问题就“刷”出线索；只有宽泛的话题词才允许用整轮文本兜上下文。干扰角色和老板酒局没有线索定义，不会误进笔记本。

### AI native mode（灰度）：线索裁判取代正则
`AI_NATIVE_MODE=1` 时（issue #16 第一期第 1 项），兜底判定从关键词规则升级为 `lib/judge.ts` 的**线索裁判**——演员/裁判分离：演员照常流式演人，流尾追加一次非流式、温度 0、`json_object` 的裁判调用，语义级判断「这轮 NPC 到底说没说到哪条线索」（判定标准 = 每条 Clue 的 `criteria`）。产出仍走 `[[CLUE:id]]` 流尾标记，`Dialogue.tsx` 一行不动。

「LLM 提议、服务端裁决」三闸，验不过即丢：① id 必须在该角色线索白名单内；② 每条判定必须附 **NPC 回答的逐字连续子串**（≥8 字）作 evidence；③ 只认 NPC 回答不认玩家提问——裁判的输入里根本没有玩家文本，塞答案进提问无效。降级路径 = 现状：开关未开 / 无 key / 8 秒超时 / JSON 不合法，一律原样跑 `inferClueIds`，逐字节等于经典模式。灰度期间双轨跑，裁判与规则分歧的样本落 Supabase `judge_samples` 表复核。

```
src/
  app/
    page.tsx            落地页 + brief
    play/page.tsx       办公室（Office + Dialogue）
    api/chat/route.ts   流式对话入口（DeepSeek）+ 采集
  components/
    Office.tsx          canvas 场景 + 点击命中（"哑渲染层"）
    office-draw.ts       纯绘制函数（自绘像素办公室）
    Dialogue.tsx        DOM 对话浮层（真流式读取）
  lib/
    personas.ts         4 个货代人设（摹自真实驻场素材）
    llm.ts              DeepSeek 流式（无 key 时 mock 兜底）
    clueDetection.ts    服务端线索兜底（判别词只认 NPC 回答，防漏标记也防刷线索）
    store.ts            Supabase 采集（无配置时降级日志）
    types.ts
```

## 本地运行
```bash
npm install
cp .env.example .env.local   # 填 DEEPSEEK_API_KEY（不填也能跑，走 mock）
npm run dev                  # http://localhost:3000
```

## 环境变量
见 `.env.example`：
- `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` — 不配则 `/api/chat` 用内置 mock 人设回复（开箱即玩）。
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — 不配则采集降级为服务端日志（不阻断对话）。

## Supabase 建表
```bash
# 在 Supabase SQL Editor 执行
psql < supabase/schema.sql   # 或复制 supabase/schema.sql 内容到控制台
```

## 部署（Vercel）
1. 推到 GitHub，Vercel 导入。
2. 配置环境变量（同上）。
3. 合并到主分支即自动部署。

## 素材与授权
- 中文像素字体：**Fusion Pixel**（TakWolf，SIL OFL 1.1，商用免费，已署名）。
- 像素精灵：**CC0**（Kenney 等，零授权风险）。
- ⚠️ 切勿提交付费素材原始包（如 LimeZu）到公开仓库；勿用任何 ripped 美术。

## 已知 / 下一步
- v1 渲染为自渲染 + CC0 精灵的办公室、**点击对话**。文档里规划的 Smallville 级（Pixi + A* 平滑寻路行走 + 走到家具后）是下一迭代。
- 采集到的对话用于后续"动态评分"（评分后置、人主导）。
