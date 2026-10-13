# research-service

把 [gpt-researcher](https://github.com/assafelovic/gpt-researcher) 的 LangGraph 多智能体流水线挂到 monitor-ai：
**信号（monitor-ai 快照）→ 研究课题 → 多智能体协作研究 → 带引用的中文技术情报报告**。

上游以子目录 `gpt-researcher/` 形式引入，版本锁定在 `pinned-commit.txt`，不做二次修改；
本目录只放"胶水"：信号桥接、协作事件流、HTTP 接口。

## 上游协作拓扑（multi_agents，LangGraph）

```
browser(初步检索)
  → planner(主编规划章节) → human(可选人工反馈) → researcher × N(每章并行)
        每章内部：researcher → reviewer →(revise)→ reviser ─┐
                              ↑──────────────────────────────┘
  → writer(合稿) → fact_checker ─(revise)→ writer
  → visualizer(生成 mermaid 图) → publisher(Markdown/PDF/DOCX)
```

## 安装

```powershell
cd research-service
./setup.ps1                 # 克隆上游(固定 commit) + uv 建 venv + 装依赖
# 然后填 .env：至少 DEEPSEEK_API_KEY
```

## 运行

```powershell
# 1) 只看桥接挑出的信号（不花钱）
.venv/Scripts/python.exe run_task.py --signals-only

# 2) 跑一次信号驱动的研究（实时打印协作事件，产物写入 ./outputs/ 与 ./runs/）
.venv/Scripts/python.exe run_task.py --focus "AI 智能体编排框架" --top 10

# 3) 起 HTTP 服务给 monitor-ai 调
.venv/Scripts/python.exe -m uvicorn service.app:app --host 127.0.0.1 --port 8000

# 4) 跑测试（需要先 uv pip install -r requirements-dev.txt）
.venv/Scripts/python.exe -m pytest tests -q
```

## 配置要点（.env）

| 变量 | 说明 |
| --- | --- |
| `DEEPSEEK_API_KEY` | 必填。多智能体所有 LLM 调用都走 `SMART_LLM` 的 provider |
| `FAST_LLM`/`SMART_LLM`/`STRATEGIC_LLM` | `provider:model` 格式；`STRATEGIC_LLM` 的模型名会作为多智能体的 `task.model` |
| `RETRIEVER` | 逗号分隔。免 key：`openalex`（默认）/`arxiv`/`semantic_scholar`/`duckduckgo`；需 key：`tavily`/`bocha`（国内搜索） |
| `CONTEXT_FILTER=keyword` | 不依赖 embedding 服务（默认 `auto` 也可能退化为 keyword） |
| `MAX_URLS_TO_SCRAPE` | 抓正文的页数，直接影响 token 成本 |

检索器实测（2026-10，本机直连）：

| 检索器 | 结果 |
| --- | --- |
| `openalex` | 可用，但对超长 query 返回 `400`（见下） |
| `arxiv` | 有 ~3s 限流，并发子查询大量 `429` → 证据上下文为空，默认不启用 |
| `semantic_scholar` | 无 key 时经常 `429` |
| `tavily` / `bocha` | 需 key；覆盖新闻与厂商页面最好，情报场景建议配上 |

## HTTP 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 上游 commit、模型、检索器、key 是否就位、运行中的任务 |
| GET | `/research/history` | 报告库列表（运行中 + 已落盘，按时间倒序） |
| GET | `/research/history/{task_id}` | 单条历史记录全文（报告 + 全部协作事件） |
| POST | `/research` | `{focus?, query?, categories?, top?, max_sections?}` → `{run_id}` |
| GET | `/research/{run_id}` | 状态、报告全文、全部协作事件 |
| GET | `/research/{run_id}/events` | SSE 实时协作事件流（结束/失败后立即收尾） |

前端在 `/nexus` 观测中枢的「情报研究」页签里（`/nexus?tab=research`），经 Next 的 `/api/research/*` 反代调用以上接口（`/api/research/run*` → `/research*`，`/api/research/history*` → `/research/history*`）。

## 运行记录

每次运行（HTTP 或 CLI）都落盘到 `runs/<task_id>.json` + `runs/<task_id>.md`：
报告全文、协作事件、耗时、用到的信号 id。报告库因此不依赖进程内存，重启后仍可回看。

## 展示层规范化（报告小标题）

上游 `multi_agents/agents/writer.py::revise_headers` 只负责把 4 个固定槽位
（Introduction / Table of Contents / Conclusion / References）改名，却把 task 的**全部 guidelines**
喂给模型，于是模型把准则原文当成标签，写出 `## 引言：说明基于 monitor-ai 监测快照确定分析方向与取证线索…`；
带图示时 publisher 还会插入硬编码的英文 `## Visualizations`。

`service/postprocess.py` 在展示层按**语义锚点**还原标签（不按固定序号：Visualizations 会插在结论之后）：

- `参考文献` = 最后一个二级标题；`结论` = `## Visualizations` 前那个，无图示时取倒数第二个
- `引言` / `目录` = 第 1 / 第 2 个二级标题；`Visualizations` → `可视化`
- 标签本身 ≤12 字时不动；代码块内的 `##` 不参与识别；正文一字不改

生效位置：`/research/{run_id}` 与 `/research/history/{task_id}` 的响应、`runs/<task_id>.md`。
`runs/<task_id>.json` 保留上游原文，便于追溯与对比。

## 已知边界

- **检索 query 不能塞长文本**：整段信号清单进 `query` 会让 OpenAlex 返回 400、arXiv 限流 429，
  证据基座直接为空。因此 `signals.py` 的 query 只放「方向 + 前 4 条信号标题」，
  完整信号清单（含 URL）放进 `guidelines`，供规划/评审/写作阶段要求引用。
- 报告语言由 prompt 决定（`LANGUAGE=chinese`），中文质量需要用真实课题验证。
- 无 Tavily/博查 key 时只有学术源（OpenAlex/arXiv），新闻与厂商动态会缺失。
- `publish_formats` 只开 Markdown：PDF 依赖 weasyprint 的原生库，Windows 上容易崩。
- 上游协作是固定图，"协作机制本身"尚未改造——这是后续论文创新点的落点。
- 本机有外部客户端把 `127.0.0.1:8000` 当成 OpenAI 兼容端点，持续探测 `GET /v1/models`（已确认不是本仓库的配置，
  环境变量与代码里都没有本地 LLM 端点）。响应仍是 404，但访问日志会过滤掉这类 404，避免淹没真实请求。
  如果发现是某个工具配错了 base URL，改它的配置即可 —— 端口是它认错，不是我们的问题。
- 部署侧：nginx 的 SSE 反代已写进 `deploy/nginx-monitor-ai.conf`（`/api/research/` 关缓冲 + 3600s 读超时），
  常驻单元在 `deploy/monitor-ai-research.service`，步骤见 `deploy/deploy-guide.md` 第 4.6 节。
  注意：本机没有 nginx，配置只做了人工核对，上线前需要在服务器上跑 `nginx -t`。


## 持续研究与协作配置

工作台支持固定配置和按任务、资料状态调整的配置。选择已完成报告后，可勾选继续研究，将历史报告作为待核查上下文，同时比较前后信号快照。后续报告保留父任务、策略版本、输入摘要和变化清单。快照缺失不代表现实事实失效，来源评分不代表事实真实性。

POST /research/preview 接受与创建研究相同的请求，仅返回任务和策略摘要，不调用模型。可选字段 policy_mode 为 adaptive 或 fixed，parent_task_id 为已完成且有报告的数字任务编号。前端代理路径为 /api/research/run/preview。

当前状态驱动策略为有界规则：根据问题类型组织研究要求，对风险分析或资料稀疏、缺少来源链接等情况增加审核轮次；它不改变上游图结构，也不宣称自动预算优化。增量研究目前实现资料差异、有界历史上下文与任务版本关联，结论更新仍由研究流程完成，需用资料核查评价。结构化主张级更新属于后续研究方向。

验证：在本目录运行 python -m pytest tests -q。代码测试验证变化分类、去重、审核配置与历史关联；分析质量和节省开销需另做受控实验，不能从单元测试推导。对照时保持模型、检索工具和资料范围一致，并同时记录实际调用开销。
