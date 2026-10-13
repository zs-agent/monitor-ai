# monitor.ai

**AI Global Intelligence Stream** — Real-time AI signal aggregation with bilingual switching.

## Data Sources

| Source | Type | Provider ID | Credibility |
|--------|------|-------------|-------------|
| [Hacker News](https://news.ycombinator.com) | Top AI-related stories | `hackernews` | 3/5 |
| [HuggingFace Daily Papers](https://huggingface.co/papers) | Daily AI papers | `huggingface` | 4/5 |
| [GitHub Trending](https://github.com/search) | Trending AI repos | `github` | 3/5 |
| [Semantic Scholar](https://www.semanticscholar.org) | AI research papers | `semanticscholar` | 4/5 |

Data flow: each source is wrapped as a `SignalProvider` (`src/lib/sources/`). The `/api/signals` endpoint fetches all providers in parallel with `Promise.allSettled`, deduplicates, and applies category/language filters. A fallback chain ensures availability:

1. **Real data** from all successful providers
2. **Stale cache** if all providers fail (up to 5 min old)
3. **Mock data** only as last resort (tagged with `"fallback": "mock"` in response)

### Background polling (tiered)

After the first request, `src/lib/poller.ts` starts a per-process background poller that refreshes snapshots at per-provider intervals (`pollIntervalMs`) and persists them to `data/signals-snapshot.json` (restart-safe). Requests then mostly hit the fresh in-memory snapshot with **zero network I/O** (`"cached": true`):

| Provider | Interval | Rationale |
|----------|----------|-----------|
| `hackernews` | 90s | High-frequency news feed |
| `rsshub` | 5min | Self-hosted instance, moderate cost |
| `huggingface` | 10min | Daily papers change slowly |
| `github` | 10min | Avoid unauthenticated API rate limit (60 req/hr) |
| `semanticscholar` | 10min | Paper search, slow-moving |

Tiered refresh merges only the polled providers into the snapshot (others kept as-is). Requires a long-running Node process (`next start` / `start:prod`); **not supported on serverless platforms** — there the endpoint still falls back to on-demand fetching.

Explicit mock mode: `?mock=1` on `/api/signals` returns only mock data for debugging.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No | GitHub personal access token (increases API rate limit from 60 to 5000 req/hr) |
| `NEXT_PUBLIC_API_URL` | No | API base URL (defaults to same origin) |
| `RSSHUB_BASE_URL` | No | Self-hosted RSSHub instance URL (e.g. `http://127.0.0.1:1200`). Do not use the public `rsshub.app`. When unset, the `rsshub` source is skipped with a health error |
| `OPENAI_API_KEY` | No | OpenAI-compatible API key for AI Insights (default provider: DeepSeek). When unset, insights degrade to statistics-only |
| `OPENAI_BASE_URL` | No | OpenAI-compatible API base URL (default `https://api.deepseek.com`) |
| `MODEL_NAME` | No | Model ID for AI Insights (default `deepseek-chat`) |

For deploy scripts, set these environment variables instead of hardcoding credentials:

```powershell
$env:MONITOR_AI_SERVER_IP = "your.server.ip"
$env:MONITOR_AI_SERVER_PASSWORD = "your-password"
```

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- date-fns
- vitest (testing)

## Development

```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Build for production (standalone output + static assets copy)
npm run build

# Run tests
npm run test

# Start production server
npm run start:prod
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
  app/              # Next.js App Router pages & API routes
    api/signals/    # Main signals aggregation endpoint (provider-based)
    api/research/[[...path]]/  # BFF proxy → research-service（情报研究）
    api/github-trending/  # GitHub trending repos (lightweight)
    api/ai-papers/        # Semantic Scholar papers (lightweight)
  components/       # UI components
    research/       # 情报研究工作台（报告库 / 报告阅读 / 协作过程）
  data/             # Static data (mock signals, leaderboard)
  lib/
    markdown.tsx    # 报告 Markdown 渲染（零依赖）
    sources/        # SignalProvider implementations
      types.ts      # Provider interface
      hackernews.ts
      huggingface.ts
      github.ts
      semanticscholar.ts
      index.ts      # Provider registry
    normalizer.ts   # Signal normalization per source
    data-freshness.ts  # Source health tracker
    fetch-with-timeout.ts  # Fetch wrapper with timeout
  types/
    signal.ts       # Signal data model
```

## Verification

- `npm run build` must exit with code 0
- `/api/signals` returns real data (see `"sourceHealth"` in response)
- Mock data never mixes into normal results (only as `fallback: 'mock'`)
- External source failures are reported via `sourceHealth` and `SourceHealthPanel`

## 情报研究（多智能体）

`research-service/` 把 [gpt-researcher](https://github.com/assafelovic/gpt-researcher) 的 LangGraph 多智能体流水线挂到监测信号上：
**信号 → 研究课题 → 规划章节 / 并行检索 / 评审改写 / 事实核查 / 成稿 → 带引用的中文技术情报报告**。

- 前端入口：`/nexus` 观测中枢 = 多智能体情报工作台，两个页签 **看板 / 情报研究**（URL 直达：`/nexus?tab=dashboard|research`；旧的 `?tab=stream` 会回退到看板）。
- 「看板」按类别分四组（面板保持平铺，只加分组标头）：
  1. **态势研判** — 生态地图
  2. **今日 AI 洞察**（一个模块两种视图，标头右侧切换）— **当日研判**：洞察 + 核心判断侧栏（含重点关注与新闻轮播）；**情报检索**：**情报浏览器**（同一批数据的三个维度视图：信号 / 厂商 / 模型，左列表右档案，列可排序）。两个视图都常驻挂载，切走再切回不丢筛选、选中与关注状态
     - **洞察 → 检索 联动（结论给判断，检索给证据链）**：每个洞察分类行右侧「支撑信号 ▸」直接切到检索视图并打上该分类筛选；面板底部吸附一行「证据链 N 信号 · N 厂商 · N 模型 → 打开情报检索」，规模由浏览器实时上报
  3. **模型与 Agent 技术** — 模型报告 · 竞技场 · Agent 紧箍咒
  4. **开源生态** — Agent 开源雷达
- 看板级能力：**信号时间窗**（顶部一处切换，地图/洞察/侧栏/浏览器同时生效）、**关注清单**（行尾 ☆，本机 localStorage）、**厂商对比**（行尾 ⇄，最多两家并排四个指标）、**保存视图**（当前筛选组合存本机，点名字套用）。
- 实体档案页：`/entity/vendor/<id>`、`/entity/model/<id>` —— 面包屑 + 四个标签页（概览 / 时间线 / 关联 / 评估），可从浏览器右栏「完整档案 →」进入，并可「用这个实体发起研究」（跳到研究工作台并预填课题）。
- 「情报研究」= 研究三栏（报告库 · 报告阅读 · 协作过程）。浏览器只访问 `/api/research/*`，由 Next 反代到 Python 服务，页面不直连。
- 服务：`research-service/`（FastAPI + 上游仓库，版本锁定在 `pinned-commit.txt`，**未改动上游源码**）。
- 运行记录落盘 `research-service/runs/<task_id>.json`（含报告全文与全部协作事件），服务重启后报告库仍在。

```bash
# 1) 研究服务：先在 research-service/.env 填 DEEPSEEK_API_KEY，再启动
cd research-service && .venv/Scripts/python.exe -m uvicorn service.app:app --host 127.0.0.1 --port 8000

# 2) 前端
npm run dev
```

接口：`/health`、`GET /research/history`、`GET /research/history/{task_id}`、`POST /research`、`GET /research/{run_id}`、`GET /research/{run_id}/events`(SSE)。
详细配置与边界见 `research-service/README.md`。
