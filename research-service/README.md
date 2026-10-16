# 结构化技术情报研究服务

默认流程由本系统的 LangGraph 图控制：需求与规划 → 按问题研究 → 条件核查 → 结果整合。监测属于前置资料获取阶段，专题研究统一为事实核查、对象比较、动态分析、风险研判。

## 运行

从 research-service 目录执行：

```text
.venv/Scripts/python.exe -m uvicorn service.app:app --host 127.0.0.1 --port 8000
.venv/Scripts/python.exe run_task.py --focus LangGraph --task-type fact_check --action-budget 4
.venv/Scripts/python.exe run_task.py --query LangGraph --signals-only --json
.venv/Scripts/python.exe -m pytest tests -q
```

前端入口为 `/nexus?tab=research`，经 Next 的 `/api/research/*` 反代。演示使用结构化流程；旧流程只保留为显式 API/CLI 兼容入口（`engine=legacy`），不作为论文核心实现。CLI 默认也使用结构化流程，`--json` 仅输出合法 JSON。

## 三个核心机制

| 研究内容 | 实现 | 可观察结果 |
|---|---|---|
| 跨源线索与问题关联 | research_state.py：URL规范化、标题/摘要/资料时间指纹、转载去重、英文词项/中文双字Jaccard、能力/部署/生态/风险词表 | 清洗记录、相似度、挂载问题、未匹配原因、同来源版本冲突 |
| 状态与预算动作配置 | 状态 `(t,n,u,c)`；`p=1+n+u+I(c<1)`；多选择背包回溯指针 | 候选成本/效用、选中包、暂缓问题、预算账本 |
| 状态差分与局部复核 | 显式 Q/E/C/R、证据版本指纹、依赖影响定位、来源硬校验 | 新增/变化/稳定/快照缺失、局部唤醒、沿用/修订/待核查、引用原文及旧版结论 |

Q 采用稳定ID和修订号，C 保存事实/推断、来源键、证据指纹、不确定性与核查记录，E 保存规范化来源键、正文、内容指纹和抓取时间，R 明确存储问题—资料及结论—资料关联。资料变化后保留引用过的旧版本，不将本次快照缺失等同于事实失效。

动作包：`defer` 成本0效用0，`research` 成本1效用4p，`research_and_verify` 成本2效用4p+2+风险任务偏好1。DP 核心复杂度 O(NBK)，预算为0时 O(NK)；回溯指针空间 O(NB)。相同效用保留已有选择，最后优先较小消耗。效用是状态代理，不能当作真实质量收益。

## 接口契约

```json
{"engine":"structured","focus":"LangGraph","task_type":"fact_check","action_budget":4,"scheduler_mode":"adaptive","association_mode":"structured","time_scope":"","snapshot":[]}
```

`task_type`：`fact_check`、`object_comparison`、`dynamic_analysis`、`risk_assessment`。旧四类别名仅用于兼容历史输入，响应状态使用规范名称。`parent_task_id` 指向具有结构化状态的 done/partial 报告，对象及任务类型须一致。

| 方法 | 后端路径 | Next路径 | 用途 |
|---|---|---|---|
| POST | /research/preview | /api/research/preview | 零模型调用预览，返回structured_state与allocation |
| POST | /research | /api/research/run | 创建任务 |
| GET | /research/{run_id} | /api/research/run/{run_id} | 当前状态、部分状态图或结果 |
| GET | /research/{run_id}/events | /api/research/run/{run_id}/events | 有界SSE事件、终态收尾 |
| POST | /research/{run_id}/cancel | /api/research/run/{run_id}/cancel | 取消并保留动作记账 |
| GET | /research/history | /api/research/history | 历史记录，limit范围1..200 |
| GET | /research/history/{task_id} | /api/research/history/{task_id} | 报告、依赖图、审核与父子版本 |

终态区分 `done`、`partial`、`failed`、`cancelled`。保存完成后发送终止事件；保存失败仍发送失败事件。运行开始写入临时记录，服务重启将中断任务明确标为 failed。前端用状态轮询补偿SSE中断，处理请求竞态、重复启动与过时回调。

## 对照与消融

| 参数 | 含义 |
|---|---|
| scheduler_mode=adaptive | 状态效用 + MCKP + 局部更新 |
| scheduler_mode=fixed | 等效用分配，保持相同预算上限 |
| scheduler_mode=single | 只有研究角色，不运行核查角色；仍按问题组织资料 |
| scheduler_mode=full | 强制全部问题重新核查，预算不足的结论保留待核查状态 |
| association_mode=unfiltered | 关闭对象及维度筛选，去重后的线索全部挂载，作为关联机制消融 |

注入 `snapshot` 可固定监测输入。实验CLI提供冻结检索资料，同时保留真实模型调用：

```text
.venv/Scripts/python.exe experiment.py --snapshot snapshot-v1.json snapshot-v2.json --focus LangGraph --task-type fact_check --budget 2 4 --mode adaptive fixed single full --repeats 3 --evidence-fixture evidence-v1.json evidence-v2.json --output runs/experiment-matrix
```

每个快照文件为信号数组，冻结资料文件为含title/url/content/retrieval_level的数组，文件数必须与快照数一致，防止T2资料进入T1。失败组保存为failed且不继续作为下一快照父状态。冻结资料须使用真实来源内容，不能用模拟输出替代质量实验。各策略共享预算上限，实际消耗单独报告；单研究角色可能无法用完预算。输入摘要、参数、策略、父子状态、动作失败、耗时、检索批次、模型调用与Token用量写入 `runs/experiments/<task_id>.json`，矩阵另保存完整结果。

## 依赖与配置

LangGraph负责显式状态图。GPT Researcher提供quick_search及scraper_manager组件，不在结构化流程中调用ChiefEditor流水线。保留上游来源、许可证和pinned-commit.txt；自研状态、关联、调度、版本、接口及展示层位于service与src目录。安装仍可使用setup.ps1；修改脚本使用Python避免编码问题。

模型读取 `.env` 的 SMART_LLM，实际调用模型/提供方写入动作日志。STRATEGIC_LLM是历史任务配置的模型名，两者可能不同，以动作记录为准。RETRIEVER控制检索来源；模型Key不进入前端。前端运行于Next.js 15.5.27；Node版本须满足Next依赖声明。

## 验证与边界

本次72项后端回归测试与40项前端测试通过，tsc/lint/生产构建通过。最新真实模型冻结原文验收完成2动作：10条结论中5条支持、5条待核查，整体partial。合成T1/T2样例验证稳定基础事实0重复动作；这些不证明真实质量提升。原文审核标签仍是模型辅助判断，须独立人工评价。

动作单位限制宏观检索/生成调用，不是费用或Token硬上限。内部HTTP请求数可能超过检索批次；没有提供方用量时Token记为null。失败尝试计费，未发起核查明确记为0动作跳过。资料只有检索摘要时标记snippet，不能仅靠摘要将结论判为支持。

当前部署按单个服务进程设计，运行句柄保留近期128条，最多8个并行任务；完整历史在磁盘。爬取前拒绝直接私网来源，但重定向/DNS重绑定仍需生产环境网络出口隔离；不将该检查称为完整爬虫沙箱。外网检索可限流、失效或返回空集，测试不会把这些情况伪装为成功。

运行时npm依赖审计0漏洞；开发工具链仍有9项告警（braces、Tailwind及文件匹配/选择器相关组件），未使用强制跨版本修复来伪造清零。详见[完整V2对齐与修复记录](../docs/V2对齐与修复.md)。

## V2新增入口

工作台使用“资料关联 / 分析安排 / 版本对比 / 效果与评阅”四视图；“体验版本更新样例”无需模型密钥，高级参数默认折叠。

| 方法 | 后端路径 | 用途 |
|---|---|---|
| GET | /research/contracts | 规范枚举、参数默认值与Schema |
| POST | /research/demo | 合成开源模型版本更新T1/T2样例 |
| GET | /research/experiments | 已完成/部分完成的真实实验记录 |
| POST | /research/history/{task_id}/reviews | 人工抽样核查及分歧处理 |

Next路径统一加/api前缀。合成样例标注synthetic_demo并保存在runs/demos，不混入正常报告/真实对照记录。无标注/未测量的指标显示未知。

请求scheduler_config可设置alpha=4、beta_verify=2、beta_risk=1、w0=wn=wu=wc=1、max_feedback_rounds=1、ablations=[]。消融项drop_n/drop_u/drop_c/drop_t/equal_utility。questions支持稳定id、axis、question、task_type，同一维度可有多问题；manual_associations支持evidence_key、object_name、question_ids、reason，校正后重新预览并用于下一次研究。

合同生成：在仓库根目录执行python scripts/export_contracts.py；追加--check检查前后端枚举是否漂移。默认pytest仅运行自有tests。

RESEARCH_RUNS_DIR隔离运行数据。ASSOCIATION_EMBEDDING_URL/MODEL/KEY配置真实向量服务，缺配置明确报错。默认DuckDuckGo一次有界回退，RESEARCH_SEARCH_FALLBACK=none关闭；requirements.txt固定ddgs版本。OpenAlex限流不再被静默当成没有资料。

API snapshot固定的是关联输入，后续研究仍在线检索；控制检索资料的实验使用CLI逐快照冻结资料。2026-10-16已修复本机代理Fake-IP兼容：仅对Fake-IP域名通过可信HTTPS DNS校验真实公网IP，并固定IP抓取、逐跳校验重定向，保留TLS/私网防护。同一用户问题的联网研究与核查重跑成功；详见[修复记录](../docs/2026-10-16研究失败修复.md)。

离线配置矩阵（在research-service目录）：

```text
.venv/Scripts/python.exe experiment.py --demo --mode adaptive fixed --alpha 2 4 8 --beta-verify 1 2 --ablation none drop_n drop_t drop_c equal_utility --budget 8 --output runs/demo-matrix
```
